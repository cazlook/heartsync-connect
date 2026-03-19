import os
import time
import logging
import hashlib
import secrets
from typing import Dict, Optional, Callable
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

# ── Logging strutturato (NON esporre stack trace in produzione) ──────────────
IS_PRODUCTION = os.getenv("ENVIRONMENT", "development") == "production"

logging.basicConfig(
    level=logging.WARNING if IS_PRODUCTION else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("SyncLove.security")

# ── Configurazione ───────────────────────────────────────────────────────────
ALLOWED_ORIGINS = [
    os.getenv("FRONTEND_URL", "https://SyncLove.app"),
    os.getenv("FRONTEND_URL_WWW", "https://www.SyncLove.app"),
]

RATE_LIMIT_CONFIG = {
    "/api/auth/login":        {"calls": 5,   "window": 300},   # 5 tentativi / 5 min
    "/api/auth/register":     {"calls": 3,   "window": 3600},  # 3 registrazioni / ora
    "/api/auth/refresh":      {"calls": 10,  "window": 60},    # 10 refresh / min
    "/api/biometric/reaction":{"calls": 30,  "window": 60},    # 30 reazioni / min
    "default":                {"calls": 100, "window": 60},    # 100 req / min globale
}

# Storage in-memory per rate limiting (in produzione usa Redis)
_rate_store: Dict[str, list] = defaultdict(list)

# IP bloccati per brute force
_blocked_ips: Dict[str, float] = {}  # ip -> timestamp blocco
BLOCK_DURATION = 900  # 15 minuti
FAILED_LOGIN_THRESHOLD = 10  # blocca dopo 10 fallimenti in 5 min
_failed_logins: Dict[str, list] = defaultdict(list)


# ── Manutenzione SERVER-SIDE (mai nel sessionStorage del browser) ─────────────
_maintenance_mode: bool = False
_maintenance_allowed_ips: list = [
    ip.strip() for ip in os.getenv("MAINTENANCE_ALLOWED_IPS", "").split(",") if ip.strip()
]


def set_maintenance_mode(enabled: bool) -> None:
    global _maintenance_mode
    _maintenance_mode = enabled
    logger.warning(f"Maintenance mode {'ENABLED' if enabled else 'DISABLED'}")


def is_maintenance_mode() -> bool:
    return _maintenance_mode


# ── Helpers ──────────────────────────────────────────────────────────────────

def get_client_ip(request: Request) -> str:
    """Estrae l'IP reale del client, considerando reverse proxy."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def is_ip_blocked(ip: str) -> bool:
    """Controlla se un IP e' bloccato per brute force."""
    if ip in _blocked_ips:
        if time.time() - _blocked_ips[ip] < BLOCK_DURATION:
            return True
        else:
            del _blocked_ips[ip]
            _failed_logins.pop(ip, None)
    return False


def record_failed_login(ip: str) -> None:
    """Registra un login fallito. Blocca l'IP dopo FAILED_LOGIN_THRESHOLD."""
    now = time.time()
    window = 300  # 5 minuti
    _failed_logins[ip] = [t for t in _failed_logins[ip] if now - t < window]
    _failed_logins[ip].append(now)

    if len(_failed_logins[ip]) >= FAILED_LOGIN_THRESHOLD:
        _blocked_ips[ip] = now
        logger.warning(f"IP BLOCCATO per brute force: {ip}")


def check_rate_limit(ip: str, path: str) -> bool:
    """Ritorna True se la richiesta e' entro i limiti, False se da bloccare."""
    config = RATE_LIMIT_CONFIG.get(path, RATE_LIMIT_CONFIG["default"])
    key = f"{ip}:{path}"
    now = time.time()
    window = config["window"]

    _rate_store[key] = [t for t in _rate_store[key] if now - t < window]
    if len(_rate_store[key]) >= config["calls"]:
        logger.warning(f"Rate limit raggiunto: {ip} -> {path}")
        return False

    _rate_store[key].append(now)
    return True


# ── Middleware principale ─────────────────────────────────────────────────────

class SecurityMiddleware(BaseHTTPMiddleware):
    """Middleware che applica tutti i controlli di sicurezza a ogni richiesta."""

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        ip = get_client_ip(request)
        path = request.url.path
        method = request.method

        # 1. Modalita' manutenzione SERVER-SIDE
        if _maintenance_mode and ip not in _maintenance_allowed_ips:
            return JSONResponse(
                status_code=503,
                content={"detail": "Servizio in manutenzione. Riprova tra poco."},
                headers={"Retry-After": "3600"},
            )

        # 2. Blocco IP brute force
        if is_ip_blocked(ip):
            return JSONResponse(
                status_code=429,
                content={"detail": "Troppi tentativi. Riprova tra 15 minuti."},
            )

        # 3. Rate limiting per endpoint
        if not check_rate_limit(ip, path):
            return JSONResponse(
                status_code=429,
                content={"detail": "Troppe richieste. Rallenta."},
                headers={"Retry-After": "60"},
            )

        # 4. Blocca accesso diretto a /admin da URL pubblico
        if path.startswith("/admin"):
            logger.warning(f"Tentativo accesso /admin bloccato: {ip}")
            return JSONResponse(status_code=404, content={"detail": "Not found"})

        # 5. Forza HTTPS in produzione
        if IS_PRODUCTION and request.headers.get("x-forwarded-proto") == "http":
            https_url = str(request.url).replace("http://", "https://", 1)
            return Response(
                status_code=301,
                headers={"Location": https_url, "Cache-Control": "no-store"},
            )

        # 6. Processa la richiesta
        try:
            response = await call_next(request)
        except Exception as exc:
            # Non esporre mai i dettagli dell'eccezione in produzione
            logger.error(f"Errore interno: {type(exc).__name__} su {path}")
            if IS_PRODUCTION:
                return JSONResponse(
                    status_code=500,
                    content={"detail": "Errore interno del server."},
                )
            raise

        # 7. Aggiunge security headers a OGNI risposta
        response = add_security_headers(response)

        return response


def add_security_headers(response: Response) -> Response:
    """Aggiunge tutti gli header HTTP di sicurezza."""
    headers = {
        # Previene clickjacking
        "X-Frame-Options": "DENY",
        # Previene MIME sniffing
        "X-Content-Type-Options": "nosniff",
        # Forza HTTPS per 1 anno (HSTS)
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
        # Content Security Policy per dating app
        "Content-Security-Policy": (
            "default-src 'self'; "
            "img-src 'self' data: blob: https://*.supabase.co https://*.amazonaws.com; "
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "frame-ancestors 'none';"
        ),
        # Previene XSS (legacy, ma ancora utile)
        "X-XSS-Protection": "1; mode=block",
        # Non inviare il referrer a siti esterni
        "Referrer-Policy": "strict-origin-when-cross-origin",
        # Disabilita accesso a feature sensibili non necessarie
        "Permissions-Policy": (
            "geolocation=(self), "
            "camera=(), "
            "microphone=(), "
            "payment=(), "
            "usb=(self)"
        ),
        # Non cachare risposte di API
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
    }
    for key, value in headers.items():
        response.headers[key] = value
    return response


# ── CORS Strict (da usare in server.py al posto di allow_origins=["*"]) ───────

def get_cors_config() -> dict:
    """Configurazione CORS restrittiva per produzione."""
    return {
        "allow_origins": ALLOWED_ORIGINS,
        "allow_credentials": True,
        "allow_methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        "allow_headers": [
            "Authorization",
            "Content-Type",
            "X-Requested-With",
            "X-CSRF-Token",
        ],
        "expose_headers": ["X-RateLimit-Remaining"],
        "max_age": 600,
    }
