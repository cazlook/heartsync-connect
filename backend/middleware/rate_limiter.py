from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request, HTTPException
import logging

logger = logging.getLogger(__name__)

# Crea limiter con chiave basata sull'IP del client
limiter = Limiter(key_func=get_remote_address)

# Handler per quando il rate limit viene superato
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    logger.warning(f"Rate limit exceeded for {get_remote_address(request)}")
    raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
