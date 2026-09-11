"""Notification creation and alert policy.

Recipients: admins receive every operational alert; analysts receive inventory and sales
insights; viewers receive only notifications explicitly addressed to them. New rows are
always user-scoped. A dedupe key remains active until its condition is resolved/expired.
"""
from datetime import datetime, timezone
from typing import Any, Iterable

from sqlalchemy.orm import Session

from app.core.enums import NotificationPriority, NotificationType, UserRole
from app.models.notification import Notification
from app.models.user import User
from app.repositories import notification_repository

INVENTORY_TYPES = {NotificationType.OUT_OF_STOCK, NotificationType.LOW_STOCK, NotificationType.STOCKOUT_RISK, NotificationType.OVERSTOCK}


def recipients(db: Session, company_id: int, roles: Iterable[UserRole]) -> list[User]:
    return db.query(User).filter(User.company_id == company_id, User.status == "ACTIVE", User.role.in_(list(roles))).all()


def create_for_roles(db: Session, *, company_id: int, roles: Iterable[UserRole], notification_type: NotificationType, title: str, message: str, priority: NotificationPriority, resource_type: str | None = None, resource_id: int | str | None = None, product_id: int | None = None, payload: dict[str, Any] | None = None, dedupe_key: str | None = None) -> int:
    created = 0
    for user in recipients(db, company_id, roles):
        if dedupe_key and notification_repository.active_duplicate_exists(db, company_id, user.id, dedupe_key):
            continue
        db.add(Notification(company_id=company_id, user_id=user.id, product_id=product_id, type=notification_type, title=title, message=message, priority=priority, resource_type=resource_type, resource_id=str(resource_id) if resource_id is not None else None, payload=payload, dedupe_key=dedupe_key))
        created += 1
    if created:
        db.commit()
    return created


def create_for_user(db: Session, *, user: User, notification_type: NotificationType, title: str, message: str, priority: NotificationPriority = NotificationPriority.LOW, resource_type: str | None = None, resource_id: int | str | None = None, payload: dict[str, Any] | None = None, dedupe_key: str | None = None) -> bool:
    if dedupe_key and notification_repository.active_duplicate_exists(db, user.company_id, user.id, dedupe_key):
        return False
    db.add(Notification(company_id=user.company_id, user_id=user.id, type=notification_type, title=title, message=message, priority=priority, resource_type=resource_type, resource_id=str(resource_id) if resource_id is not None else None, payload=payload, dedupe_key=dedupe_key))
    db.commit()
    return True


def evaluate_inventory(db: Session, inventory, product) -> int:
    """Create one current alert per recipient and expire alerts for conditions now resolved.

    Rules: zero stock is CRITICAL; <= half the reorder point is HIGH stockout risk;
    <= reorder point is MEDIUM low stock; >= max(3× reorder point, reorder+20) is LOW overstock.
    """
    stock, reorder = inventory.available_stock, max(inventory.reorder_level, 0)
    if stock <= 0:
        kind, title, priority, message = NotificationType.OUT_OF_STOCK, "Stockout alert", NotificationPriority.CRITICAL, f"{product.name} has reached 0 stock. Replenish immediately."
    elif reorder and stock <= max(1, reorder // 2):
        kind, title, priority, message = NotificationType.STOCKOUT_RISK, "Stockout risk", NotificationPriority.HIGH, f"{product.name} has only {stock} units remaining and may stock out soon."
    elif reorder and stock <= reorder:
        kind, title, priority, message = NotificationType.LOW_STOCK, "Low stock alert", NotificationPriority.MEDIUM, f"{product.name} is below its reorder point ({stock} of {reorder} units remaining)."
    elif reorder and stock >= max(reorder * 3, reorder + 20):
        kind, title, priority, message = NotificationType.OVERSTOCK, "Overstock alert", NotificationPriority.LOW, f"{product.name} has {stock} units, above the healthy stock range."
    else:
        notification_repository.expire_condition_except(db, inventory.company_id, product.id, f"inventory:{inventory.id}:", "__none__")
        db.commit()
        return 0
    key = f"inventory:{inventory.id}:{kind.value}"
    notification_repository.expire_condition_except(db, inventory.company_id, product.id, f"inventory:{inventory.id}:", key)
    return create_for_roles(db, company_id=inventory.company_id, roles=[UserRole.COMPANY_ADMIN, UserRole.ANALYST], notification_type=kind, title=title, message=message, priority=priority, resource_type="Product", resource_id=product.id, product_id=product.id, payload={"product_name": product.name, "sku": product.sku, "current_stock": stock, "reorder_point": reorder, "recommended_quantity": max(reorder * 2 - stock, 0), "risk": kind.value}, dedupe_key=key)

def notify_import_result(db: Session, job) -> int:
    failed = job.status == "FAILED"
    with_errors = job.status == "COMPLETED_WITH_ERRORS"
    notification_type = NotificationType.IMPORT_FAILED if failed or with_errors else NotificationType.IMPORT_COMPLETED
    priority = NotificationPriority.HIGH if failed else (NotificationPriority.MEDIUM if with_errors else NotificationPriority.LOW)
    title = "Import failed" if failed else ("Import completed with issues" if with_errors else "Import completed")
    message = f"{job.filename}: {job.successful_records} imported, {job.failed_records} skipped or failed."
    return create_for_roles(db, company_id=job.company_id, roles=[UserRole.COMPANY_ADMIN], notification_type=notification_type, title=title, message=message, priority=priority, resource_type="DataImport", resource_id=job.id, payload={"filename": job.filename, "status": job.status, "successful_records": job.successful_records, "failed_records": job.failed_records}, dedupe_key=f"import:{job.id}:{job.status}")