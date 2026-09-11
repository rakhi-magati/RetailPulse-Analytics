from datetime import datetime, timezone
from math import ceil
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.enums import NotificationPriority, NotificationType, UserRole
from app.models.notification import Notification
from app.models.user import User


def _visible_to_user(query, user: User):
    personal = Notification.user_id == user.id
    legacy_admin = Notification.user_id.is_(None) if user.role in {UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN} else False
    return query.filter(or_(personal, legacy_admin))


def list_for_user(db: Session, user: User, page: int, limit: int, is_read: Optional[bool], notification_type: Optional[NotificationType], priority: Optional[NotificationPriority]):
    query = _visible_to_user(db.query(Notification).filter(Notification.company_id == user.company_id), user)
    if is_read is not None: query = query.filter(Notification.is_read.is_(is_read))
    if notification_type: query = query.filter(Notification.type == notification_type)
    if priority: query = query.filter(Notification.priority == priority)
    total = query.count()
    items = query.order_by(Notification.created_at.desc(), Notification.id.desc()).offset((page - 1) * limit).limit(limit).all()
    return items, total, ceil(total / limit) if total else 0


def unread_count(db: Session, user: User) -> int:
    return _visible_to_user(db.query(Notification).filter(Notification.company_id == user.company_id, Notification.is_read.is_(False)), user).count()


def get_for_user(db: Session, notification_id: int, user: User) -> Optional[Notification]:
    return _visible_to_user(db.query(Notification).filter(Notification.id == notification_id, Notification.company_id == user.company_id), user).first()


def mark_read(db: Session, notification: Notification) -> Notification:
    if not notification.is_read:
        notification.is_read, notification.read_at = True, datetime.now(timezone.utc)
        db.commit(); db.refresh(notification)
    return notification


def mark_all_read(db: Session, user: User) -> int:
    query = _visible_to_user(db.query(Notification).filter(Notification.company_id == user.company_id, Notification.is_read.is_(False)), user)
    updated = query.update({Notification.is_read: True, Notification.read_at: datetime.now(timezone.utc)}, synchronize_session=False)
    if updated: db.commit()
    return updated


def active_duplicate_exists(db: Session, company_id: int, user_id: int, dedupe_key: str) -> bool:
    return db.query(Notification.id).filter(Notification.company_id == company_id, Notification.user_id == user_id, Notification.dedupe_key == dedupe_key, Notification.is_read.is_(False), or_(Notification.expires_at.is_(None), Notification.expires_at > datetime.now(timezone.utc))).first() is not None


def expire_condition_except(db: Session, company_id: int, product_id: int, dedupe_prefix: str, active_key: str) -> int:
    return db.query(Notification).filter(Notification.company_id == company_id, Notification.product_id == product_id, Notification.dedupe_key.like(f"{dedupe_prefix}%"), Notification.dedupe_key != active_key, Notification.expires_at.is_(None)).update({Notification.expires_at: datetime.now(timezone.utc)}, synchronize_session=False)