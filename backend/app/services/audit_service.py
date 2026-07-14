from sqlalchemy.orm import Session

from app.core.enums import AuditAction
from app.models.audit_log import AuditLog


def log_action(
    db: Session,
    *,
    company_id: int,
    user_id: int,
    action: AuditAction,
    ip_address: str = "unknown",
    browser: str = "unknown",
) -> AuditLog:
    entry = AuditLog(
        company_id=company_id,
        user_id=user_id,
        action=action.value if isinstance(action, AuditAction) else action,
        ip_address=ip_address,
        browser=browser,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
