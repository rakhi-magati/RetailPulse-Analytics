from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.notification import Notification


def create(db: Session, notification: Notification) -> Notification:
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def list_by_company(db: Session, company_id: int, unread_only: bool = False) -> List[Notification]:
    query = db.query(Notification).filter(Notification.company_id == company_id)
    if unread_only:
        query = query.filter(Notification.is_read.is_(False))
    return query.order_by(Notification.created_at.desc()).all()


def mark_read(db: Session, notification: Notification) -> Notification:
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


def get_by_id_in_company(db: Session, notification_id: int, company_id: int) -> Optional[Notification]:
    return (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.company_id == company_id)
        .first()
    )
