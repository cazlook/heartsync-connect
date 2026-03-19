import os
import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

import jwt
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger("SyncLove.jwt")

# ── Configurazione JWT (tutte le chiavi da variabili ambiente, MAI nel codice) ──
JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]          # chiave forte, min 64 chars
JWT_REFRESH_SECRET = os.environ["JWT_REFRESH_SECRET"]  # chiave diversa per refresh
JWT_ALGORITHM = "HS256"

# Scadenza breve per access token (15 minuti)
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
# Refresh token valido 30 giorni
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))

# Revoca refresh token (in produzione: Redis o DB)
_revoked_refresh_tokens: set = set()


# ── Creazione token ───────────────────────────────────────────────────────────

def create_access_token(
    user_id: str,
    email: str,
    role: str = "user",
    extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Crea un JWT access token a breve scadenza (default 15 min).
    NON includere dati sensibili nel payload (e' base64, leggibile).
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,           # UUID utente (mai ID numerico)
        "email": email,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "jti": secrets.token_urlsafe(16),  # JWT ID unico (per revoca)
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    """
    Crea un refresh token a lunga scadenza (default 30 giorni).
    Deve essere salvato httpOnly cookie, mai in localStorage.
    """
    now = datetime.now(timezone.utc)
    jti = secrets.token_urlsafe(32)
    payload = {
        "sub": user_id,
        "jti": jti,
        "iat": now,
        "exp": now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, JWT_REFRESH_SECRET, algorithm=JWT_ALGORITHM)


def create_token_pair(user_id: str, email: str, role: str = "user") -> Dict[str, str]:
    """Crea access + refresh token insieme."""
    return {
        "access_token": create_access_token(user_id, email, role),
        "refresh_token": create_refresh_token(user_id),
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


# ── Verifica token ──────────────────────────────────────────────────────────

def verify_access_token(token: str) -> Dict[str, Any]:
    """
    Verifica e decodifica un access token.
    Lancia HTTPException 401 se invalido o scaduto.
    La verifica avviene SEMPRE lato server.
    """
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "sub", "jti", "type"]},
        )
        if payload.get("type") != "access":
            raise ValueError("Token type non valido")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token scaduto. Effettua il refresh.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        logger.warning(f"Token invalido: {type(e).__name__}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token non valido.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def verify_refresh_token(token: str) -> str:
    """
    Verifica il refresh token e ritorna l'user_id.
    Controlla anche la lista di token revocati.
    """
    try:
        payload = jwt.decode(
            token,
            JWT_REFRESH_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "sub", "jti", "type"]},
        )
        if payload.get("type") != "refresh":
            raise ValueError("Token type non valido")

        jti = payload.get("jti", "")
        if jti in _revoked_refresh_tokens:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token revocato. Effettua nuovamente il login.",
            )

        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessione scaduta. Effettua nuovamente il login.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token non valido.",
        )


def revoke_refresh_token(token: str) -> None:
    """Revoca un refresh token (logout). In produzione: salva su Redis/DB."""
    try:
        payload = jwt.decode(
            token, JWT_REFRESH_SECRET, algorithms=[JWT_ALGORITHM]
        )
        jti = payload.get("jti")
        if jti:
            _revoked_refresh_tokens.add(jti)
            logger.info(f"Refresh token revocato: {jti[:8]}...")
    except Exception:
        pass  # Token gia' invalido, non serve revocare


# ── FastAPI Dependency ─────────────────────────────────────────────────────

bearer_scheme = HTTPBearer(auto_error=True)


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    """
    Dependency FastAPI: estrae e verifica il JWT da ogni richiesta.
    Il controllo e' SEMPRE lato server, mai fidandosi del frontend.
    """
    payload = verify_access_token(credentials.credentials)
    return payload["sub"]


def require_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    """
    Dependency FastAPI: verifica che l'utente sia admin.
    Controllo eseguito SEMPRE lato server.
    """
    payload = verify_access_token(credentials.credentials)
    if payload.get("role") != "admin":
        logger.warning(f"Tentativo accesso admin da user: {payload.get('sub', 'unknown')}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accesso non autorizzato.",
        )
    return payload["sub"]
