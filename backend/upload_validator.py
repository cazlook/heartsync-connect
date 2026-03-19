import os
import magic
import hashlib
import logging
from io import BytesIO
from typing import Optional, Tuple

from fastapi import UploadFile, HTTPException, status
from PIL import Image

logger = logging.getLogger("SyncLove.upload")

# ── Configurazione upload ───────────────────────────────────────────────
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_IMAGE_DIMENSION = 4096  # px - previene pixel bomb
MIN_IMAGE_DIMENSION = 100   # px - niente thumbnail minuscole

# MIME types consentiti (verificati dal contenuto reale, NON dall'estensione)
ALLOWED_MIME_TYPES = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png":  [".png"],
    "image/webp": [".webp"],
    "image/heic": [".heic", ".heif"],
}

# Pattern pericolosi nel contenuto dei file (polimorfismo malware)
DANGEROUS_SIGNATURES = [
    b"<?php",
    b"<script",
    b"eval(",
    b"base64_decode",
    b"javascript:",
]


async def validate_image_upload(
    file: UploadFile,
    max_size_bytes: int = MAX_FILE_SIZE_BYTES,
) -> Tuple[bytes, str]:
    """
    Valida un file immagine lato server.
    Ritorna (content_bytes, detected_mime_type) se valido.
    Lancia HTTPException in caso di file non valido.

    Controlli eseguiti:
    1. Dimensione massima
    2. MIME type reale (tramite libmagic, NON il Content-Type del client)
    3. Integrita' dell'immagine (PIL decode)
    4. Dimensioni pixel (min/max)
    5. Pattern malware nel contenuto
    """

    # 1. Leggi il contenuto
    content = await file.read()
    size = len(content)

    if size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File vuoto non consentito.",
        )

    if size > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File troppo grande. Massimo {max_size_bytes // 1024 // 1024} MB.",
        )

    # 2. Verifica MIME type REALE (non fidarsi del Content-Type)
    try:
        detected_mime = magic.from_buffer(content, mime=True)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossibile determinare il tipo di file.",
        )

    if detected_mime not in ALLOWED_MIME_TYPES:
        logger.warning(f"Upload rifiutato: MIME non consentito '{detected_mime}'")
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Tipo file non consentito: {detected_mime}. Usa JPG, PNG o WebP.",
        )

    # 3. Verifica pattern pericolosi nel contenuto
    content_lower = content[:2048].lower()
    for pattern in DANGEROUS_SIGNATURES:
        if pattern in content_lower:
            logger.warning(f"Upload rifiutato: pattern pericoloso rilevato")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File non valido.",  # Messaggio vago intenzionalmente
            )

    # 4. Decodifica e verifica integrita' immagine con PIL
    try:
        img = Image.open(BytesIO(content))
        img.verify()  # Verifica struttura senza caricare i pixel
        img = Image.open(BytesIO(content))  # Riapri dopo verify()
        width, height = img.size
    except Exception as e:
        logger.warning(f"Upload rifiutato: immagine corrotta")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File immagine corrotto o non valido.",
        )

    # 5. Verifica dimensioni pixel (protezione pixel bomb attack)
    if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Immagine troppo grande: massimo {MAX_IMAGE_DIMENSION}x{MAX_IMAGE_DIMENSION}px.",
        )

    if width < MIN_IMAGE_DIMENSION or height < MIN_IMAGE_DIMENSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Immagine troppo piccola: minimo {MIN_IMAGE_DIMENSION}x{MIN_IMAGE_DIMENSION}px.",
        )

    logger.info(f"Upload valido: {detected_mime} {width}x{height} {size//1024}KB")
    return content, detected_mime


def generate_safe_filename(user_id: str, mime_type: str) -> str:
    """
    Genera un nome file sicuro e non prevedibile.
    Non usa mai il filename originale del client (path traversal prevention).
    """
    import secrets
    extensions = {
        "image/jpeg": ".jpg",
        "image/png":  ".png",
        "image/webp": ".webp",
        "image/heic": ".heic",
    }
    ext = extensions.get(mime_type, ".jpg")
    # UUID casuale: impossibile enumerare i file degli altri utenti
    token = secrets.token_urlsafe(32)
    return f"profiles/{user_id}/{token}{ext}"


def compute_file_hash(content: bytes) -> str:
    """Calcola SHA-256 del file per deduplication e audit."""
    return hashlib.sha256(content).hexdigest()
