from datetime import datetime
from typing import Any, Optional
from enum import Enum
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.enums import AuditAction
from app.models.audit_log import AuditLog


def _json_safe(value: Any) -> Any:
    if isinstance(value, Enum): return value.value
    if isinstance(value, Decimal): return float(value)
    if isinstance(value, datetime): return value.isoformat()
    if isinstance(value, dict): return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)): return [_json_safe(v) for v in value]
    return value


def log_action(db: Session, company_id: int, user_id: int, action: AuditAction | str,
               ip_address: str = "unknown", browser: str = "unknown", entity_name: Optional[str] = None,
               resource_type: Optional[str] = None, resource_id: Optional[int | str] = None,
               description: Optional[str] = None, before_values: Optional[dict] = None,
               after_values: Optional[dict] = None, status: str = "SUCCESS") -> AuditLog:
    """Persist a server-authenticated, append-only activity record after an operation succeeds."""
    action_value = action.value if isinstance(action, AuditAction) else action
    entry = AuditLog(
        company_id=company_id, user_id=user_id, action=action_value,
        resource_type=resource_type, resource_id=str(resource_id) if resource_id is not None else None,
        description=description, entity_name=entity_name, ip_address=ip_address,
        user_agent=browser, browser=browser, before_values=_json_safe(before_values),
        after_values=_json_safe(after_values), status=status,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
