import os
import boto3
import uuid
import logging
from datetime import datetime
from botocore.exceptions import ClientError
from fastapi import HTTPException

logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get('AWS_REGION', 'eu-west-1')
S3_BUCKET = os.environ.get('S3_BUCKET_NAME')
CLOUDFRONT_DOMAIN = os.environ.get('CLOUDFRONT_DOMAIN')  # opzionale, per CDN

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4"
}

MAX_FILE_SIZE_MB = 50
PRESIGNED_URL_EXPIRY = 300  # 5 minuti


def _get_s3_client():
    """Crea client S3 con le credenziali AWS"""
    return boto3.client('s3', region_name=AWS_REGION)


def _build_public_url(file_key: str) -> str:
    """Costruisce l'URL pubblico del file (CloudFront o S3 diretto)"""
    if CLOUDFRONT_DOMAIN:
        return f"https://{CLOUDFRONT_DOMAIN}/{file_key}"
    return f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{file_key}"


async def generate_presigned_upload_url(
    user_id: str,
    file_name: str,
    content_type: str,
    upload_type: str  # 'story' o 'profile_photo'
) -> dict:
    """
    Genera un URL pre-firmato S3 per upload diretto dal browser.
    Il client carica direttamente su S3, senza passare dal backend.
    """
    if not S3_BUCKET:
        raise HTTPException(status_code=500, detail="S3_BUCKET_NAME not configured")

    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Content type not allowed. Supported: {list(ALLOWED_CONTENT_TYPES.keys())}"
        )

    ext = ALLOWED_CONTENT_TYPES[content_type]
    unique_name = f"{uuid.uuid4()}.{ext}"
    file_key = f"{upload_type}/{user_id}/{unique_name}"

    try:
        s3 = _get_s3_client()
        presigned_url = s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': S3_BUCKET,
                'Key': file_key,
                'ContentType': content_type,
            },
            ExpiresIn=PRESIGNED_URL_EXPIRY
        )
        public_url = _build_public_url(file_key)
        logger.info(f"Generated presigned URL for {user_id}: {file_key}")
        return {
            "upload_url": presigned_url,
            "file_key": file_key,
            "public_url": public_url,
            "expires_in": PRESIGNED_URL_EXPIRY
        }
    except ClientError as e:
        logger.error(f"S3 presigned URL error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate upload URL")


async def delete_file(file_key: str) -> bool:
    """Elimina un file da S3"""
    if not S3_BUCKET:
        return False
    try:
        s3 = _get_s3_client()
        s3.delete_object(Bucket=S3_BUCKET, Key=file_key)
        logger.info(f"Deleted S3 file: {file_key}")
        return True
    except ClientError as e:
        logger.error(f"S3 delete error: {e}")
        return False
