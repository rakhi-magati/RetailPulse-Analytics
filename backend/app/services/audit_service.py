from typing import Optional

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
    entity_name: Optional[str] = None,
) -> AuditLog:
    """
    Persist a single audit trail entry. Captures Company, the
    Product/Category name (entity_name), the Action Performed, who
    Performed By (user_id) it, and the Timestamp (created_at).
    """
    entry = AuditLog(
        company_id=company_id,
        user_id=user_id,
        action=action.value if isinstance(action, AuditAction) else action,
        entity_name=entity_name,
        ip_address=ip_address,
        browser=browser,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
