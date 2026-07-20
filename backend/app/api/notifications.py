from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_company_id, require_roles
from app.core.enums import UserRole
from app.database.database import get_db
from app.repositories import notification_repository
from app.schemas.notification import NotificationOut

router = APIRouter(prefix="/notifications", tags=["Notifications"])

NotificationAccess = Depends(require_roles(UserRole.COMPANY_ADMIN, UserRole.ANALYST))


@router.get("", response_model=List[NotificationOut])
def list_notifications(
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=NotificationAccess,
):
    return notification_repository.list_by_company(db, company_id, unread_only=unread_only)


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=NotificationAccess,
):
    notification = notification_repository.get_by_id_in_company(db, notification_id, company_id)
    if not notification:
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return notification_repository.mark_read(db, notification)
