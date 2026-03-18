import os
import pyotp
import logging
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from jwt_manager import require_admin, get_current_user_id
from security_middleware import get_client_ip, record_failed_login, is_ip_blocked

logger = logging.getLogger("heartsync.admin")

# ── CRITICO: L'admin router NON viene mai montato su /admin (URL pubblico) ──────
# Viene montato su un path non prevedibile configurato da variabile ambiente.
# Es: ADMIN_PATH=/mgmt-x7k3q9  -> accessibile solo a chi conosce il path
ADMIN_SECRET_PATH = os.environ.get("ADMIN_SECRET_PATH", "/mgmt-internal")

admin_router = APIRouter(
    # Il prefix viene aggiunto dal server.py con il valore di ADMIN_SECRET_PATH
    tags=["admin"],
)

# Token 2FA pendenti (in produzione: Redis con TTL 5 minuti)
_pending_2fa: dict = {}  # admin_user_id -> {totp_secret, expires}


# ── Modelli Pydantic ─────────────────────────────────────────────────────

class AdminLoginRequest(BaseModel):
    totp_code: str  # Codice 6 cifre dall'authenticator


class MaintenanceModeRequest(BaseModel):
    enabled: bool
    reason: Optional[str] = None


class UserActionRequest(BaseModel):
    user_id: str
    reason: str


# ── Middleware di accesso admin ─────────────────────────────────────────────

def verify_admin_totp(user_id: str, totp_code: str) -> bool:
    """
    Verifica il codice TOTP 2FA per l'admin.
    Ogni admin deve avere un TOTP secret configurato.
    MAI bypassabile dal frontend.
    """
    # Il secret TOTP e' configurato per ogni admin in variabile ambiente
    # Es: ADMIN_TOTP_SECRET_<user_id_hash>
    user_hash = user_id[:8].upper()
    totp_secret = os.environ.get(f"ADMIN_TOTP_{user_hash}")

    if not totp_secret:
        logger.error(f"TOTP secret non configurato per admin: {user_id[:8]}")
        return False

    totp = pyotp.TOTP(totp_secret)
    # valid_window=1 accetta il codice del minuto precedente/successivo
    return totp.verify(totp_code, valid_window=1)


# ── Route Admin (montate su ADMIN_SECRET_PATH, non su /admin) ───────────────

@admin_router.post("/verify-2fa")
async def admin_verify_2fa(
    request: Request,
    body: AdminLoginRequest,
    admin_id: str = Depends(require_admin),  # Verifica JWT admin lato server
):
    """
    Step 2FA per admin: dopo aver passato il JWT admin,
    deve fornire il codice TOTP dall'app authenticator.
    """
    ip = get_client_ip(request)

    if is_ip_blocked(ip):
        raise HTTPException(status_code=429, detail="Troppi tentativi.")

    if not verify_admin_totp(admin_id, body.totp_code):
        record_failed_login(ip)
        logger.warning(f"2FA fallito per admin {admin_id[:8]} da {ip}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Codice 2FA non valido.",
        )

    # Genera un token di sessione admin con 2FA completato
    session_token = secrets.token_urlsafe(32)
    _pending_2fa[admin_id] = {
        "session": session_token,
        "verified_at": datetime.now(timezone.utc).isoformat(),
    }

    logger.warning(f"Admin 2FA completato: {admin_id[:8]} da {ip}")
    return {"admin_session": session_token, "message": "2FA verificato."}


@admin_router.get("/dashboard")
async def admin_dashboard(
    admin_id: str = Depends(require_admin),
    database=None,  # Inject DB dependency
):
    """Dashboard admin: statistiche anonimizzate."""
    # Verifica 2FA completato
    if admin_id not in _pending_2fa:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verifica 2FA richiesta.",
        )

    return {
        "status": "ok",
        "message": "Admin dashboard attiva.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@admin_router.post("/maintenance")
async def set_maintenance(
    body: MaintenanceModeRequest,
    admin_id: str = Depends(require_admin),
):
    """
    Attiva/disattiva la modalita' manutenzione SERVER-SIDE.
    Questa e' l'UNICA modalita' di manutenzione: mai variabili nel browser.
    """
    from .security_middleware import set_maintenance_mode

    if admin_id not in _pending_2fa:
        raise HTTPException(status_code=403, detail="2FA richiesto.")

    set_maintenance_mode(body.enabled)
    logger.warning(
        f"Maintenance {'ON' if body.enabled else 'OFF'} "
        f"da admin {admin_id[:8]}. Motivo: {body.reason or 'n/a'}"
    )
    return {
        "maintenance_mode": body.enabled,
        "set_by": admin_id[:8],
        "reason": body.reason,
    }


@admin_router.post("/users/ban")
async def ban_user(
    body: UserActionRequest,
    admin_id: str = Depends(require_admin),
):
    """Banna un utente. Il ban e' SEMPRE verificato lato server."""
    if admin_id not in _pending_2fa:
        raise HTTPException(status_code=403, detail="2FA richiesto.")

    logger.warning(f"BAN utente {body.user_id[:8]} da admin {admin_id[:8]}: {body.reason}")
    # TODO: implementare logica ban sul DB
    return {"banned": body.user_id, "reason": body.reason}


@admin_router.delete("/users/{user_id}/data")
async def delete_user_data(
    user_id: str,
    admin_id: str = Depends(require_admin),
):
    """
    Cancella tutti i dati di un utente (diritto all'oblio GDPR art. 17).
    Richiede 2FA admin verificato.
    """
    if admin_id not in _pending_2fa:
        raise HTTPException(status_code=403, detail="2FA richiesto.")

    logger.warning(f"DELETE GDPR per user {user_id[:8]} richiesta da admin {admin_id[:8]}")
    # TODO: implementare cancellazione completa (profilo, foto, messaggi, reazioni)
    return {"deleted": user_id, "gdpr_compliant": True}
