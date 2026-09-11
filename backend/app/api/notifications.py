from math import ceil
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.core.enums import AuditAction, NotificationPriority, NotificationType
from app.database.database import get_db
from app.models.user import User
from app.repositories import notification_repository
from app.schemas.notification import MarkAllReadResult, NotificationOut, NotificationPage, UnreadNotificationCount
from app.services.audit_service import log_action

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def serialize(notification) -> dict:
    return {"id": notification.id, "user_id": notification.user_id, "product_id": notification.product_id, "type": notification.type, "title": notification.title or notification.type.value.replace("_", " ").title(), "message": notification.message, "priority": notification.priority or NotificationPriority.LOW, "resource_type": notification.resource_type or ("Product" if notification.product_id else None), "resource_id": notification.resource_id or (str(notification.product_id) if notification.product_id else None), "payload": notification.payload, "is_read": notification.is_read, "created_at": notification.created_at, "read_at": notification.read_at, "expires_at": notification.expires_at}


@router.get("", response_model=NotificationPage)
def list_notifications(page: int = Query(1, ge=1), limit: int = Query(25, ge=1, le=100), is_read: Optional[bool] = None, unread_only: Optional[bool] = None, notification_type: Optional[NotificationType] = None, priority: Optional[NotificationPriority] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if unread_only is True:
        is_read = False
    items, total, pages = notification_repository.list_for_user(db, current_user, page, limit, is_read, notification_type, priority)
    return {"items": [serialize(item) for item in items], "total": total, "page": page, "limit": limit, "total_pages": pages}


@router.get("/unread-count", response_model=UnreadNotificationCount)
def get_unread_count(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return {"count": notification_repository.unread_count(db, current_user)}


@router.patch("/read-all", response_model=MarkAllReadResult)
def mark_all_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    updated = notification_repository.mark_all_read(db, current_user)
    if updated:
        log_action(db, current_user.company_id, current_user.id, AuditAction.NOTIFICATIONS_MARKED_READ, description=f"Marked {updated} notifications as read", resource_type="Notification")
    return {"updated": updated}


@router.get("/{notification_id}", response_model=NotificationOut)
def get_notification(notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    notification = notification_repository.get_for_user(db, notification_id, current_user)
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return serialize(notification)


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    notification = notification_repository.get_for_user(db, notification_id, current_user)
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    was_read = notification.is_read
    notification = notification_repository.mark_read(db, notification)
    if not was_read:
        log_action(db, current_user.company_id, current_user.id, AuditAction.NOTIFICATION_READ, description=f"Read notification {notification.id}", resource_type="Notification", resource_id=notification.id)
    return serialize(notification)