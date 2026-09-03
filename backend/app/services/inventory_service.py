from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.enums import AdjustmentType, AuditAction, MovementType, NotificationType, StockStatus
from app.models.inventory import Inventory, InventoryMovement
from app.models.notification import Notification
from app.models.product import Product
from app.models.user import User
from app.repositories import inventory_repository, notification_repository, product_repository
from app.schemas.inventory import ReorderLevelUpdate, StockAdjustmentCreate
from app.services.audit_service import log_action

ADJUSTMENT_TO_MOVEMENT = {
    AdjustmentType.STOCK_IN: MovementType.STOCK_ADDITION,
    AdjustmentType.STOCK_OUT: MovementType.STOCK_REMOVAL,
    AdjustmentType.MANUAL_ADJUSTMENT: MovementType.MANUAL_ADJUSTMENT,
}

ADJUSTMENT_TO_AUDIT_ACTION = {
    AdjustmentType.STOCK_IN: AuditAction.STOCK_ADDED,
    AdjustmentType.STOCK_OUT: AuditAction.STOCK_REMOVED,
    AdjustmentType.MANUAL_ADJUSTMENT: AuditAction.STOCK_ADJUSTED,
}


def compute_status(available_stock: int, reorder_level: int) -> StockStatus:
    if available_stock <= 0:
        return StockStatus.OUT_OF_STOCK
    if available_stock <= reorder_level:
        return StockStatus.LOW_STOCK
    return StockStatus.IN_STOCK


def ensure_inventory_for_product(db: Session, product: Product) -> Inventory:
    """Gets (or lazily creates) the Inventory row backing a product, kept in sync with it."""
    inventory = inventory_repository.get_by_product_id(db, product.id, product.company_id)
    if inventory:
        return inventory

    current_stock = product.stock_quantity or 0
    reorder_level = product.low_stock_threshold or 0
    inventory = Inventory(
        company_id=product.company_id,
        product_id=product.id,
        current_stock=current_stock,
        reserved_stock=0,
        available_stock=current_stock,
        reorder_level=reorder_level,
        stock_status=compute_status(current_stock, reorder_level),
    )
    return inventory_repository.create(db, inventory)


def _notify_status_crossing(
    db: Session,
    inventory: Inventory,
    product: Product,
    previous_status: StockStatus,
    actor: User,
    ip_address: str,
    browser: str,
) -> None:
    if inventory.stock_status == previous_status:
        return

    if inventory.stock_status == StockStatus.OUT_OF_STOCK:
        notification_repository.create(
            db,
            Notification(
                company_id=inventory.company_id,
                product_id=product.id,
                type=NotificationType.OUT_OF_STOCK,
                message=f"{product.name} is now out of stock.",
            ),
        )
        log_action(
            db,
            company_id=inventory.company_id,
            user_id=actor.id,
            action=AuditAction.PRODUCT_OUT_OF_STOCK,
            ip_address=ip_address,
            browser=browser,
            entity_name=product.name,
        )
    elif inventory.stock_status == StockStatus.LOW_STOCK:
        notification_repository.create(
            db,
            Notification(
                company_id=inventory.company_id,
                product_id=product.id,
                type=NotificationType.LOW_STOCK,
                message=f"{product.name} stock is low ({inventory.available_stock} remaining).",
            ),
        )
        log_action(
            db,
            company_id=inventory.company_id,
            user_id=actor.id,
            action=AuditAction.PRODUCT_LOW_STOCK,
            ip_address=ip_address,
            browser=browser,
            entity_name=product.name,
        )


def _apply_movement(
    db: Session,
    inventory: Inventory,
    product: Product,
    new_current_stock: int,
    movement_type: MovementType,
    reason: Optional[str],
    remarks: Optional[str],
    actor: User,
    ip_address: str,
    browser: str,
    audit_action: Optional[AuditAction] = None,
) -> Inventory:
    previous_quantity = inventory.current_stock
    previous_status = inventory.stock_status
    quantity_changed = new_current_stock - previous_quantity

    inventory.current_stock = new_current_stock
    inventory.available_stock = max(new_current_stock - inventory.reserved_stock, 0)
    inventory.stock_status = compute_status(inventory.available_stock, inventory.reorder_level)
    inventory = inventory_repository.update(db, inventory)

    inventory_repository.add_movement(
        db,
        InventoryMovement(
            inventory_id=inventory.id,
            movement_type=movement_type,
            quantity_changed=quantity_changed,
            previous_quantity=previous_quantity,
            updated_quantity=new_current_stock,
            reason=reason,
            remarks=remarks,
            performed_by=actor.id,
        ),
    )

    if audit_action is not None:
        log_action(
            db,
            company_id=inventory.company_id,
            user_id=actor.id,
            action=audit_action,
            ip_address=ip_address,
            browser=browser,
            entity_name=product.name, resource_type="Product", resource_id=product.id,
            description=f"Stock changed from {previous_quantity} to {new_current_stock}",
            before_values={"stock_quantity": previous_quantity},
            after_values={"stock_quantity": new_current_stock},
        )

    _notify_status_crossing(db, inventory, product, previous_status, actor, ip_address, browser)

    return inventory


def adjust_stock(
    db: Session,
    product_id: int,
    company_id: int,
    data: StockAdjustmentCreate,
    actor: User,
    ip_address: str,
    browser: str,
) -> Inventory:
    product = product_repository.get_by_id_in_company(db, product_id, company_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    inventory = ensure_inventory_for_product(db, product)

    if data.adjustment_type == AdjustmentType.STOCK_IN:
        new_current_stock = product.stock_quantity + data.quantity
    elif data.adjustment_type == AdjustmentType.STOCK_OUT:
        if data.quantity > inventory.available_stock:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Stock Out quantity cannot exceed available stock. "
                    f"Available: {inventory.available_stock}, requested: {data.quantity}"
                ),
            )
        new_current_stock = product.stock_quantity - data.quantity
    else:  # MANUAL_ADJUSTMENT: quantity is the corrected/target stock count
        new_current_stock = data.quantity

    if new_current_stock < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stock quantity cannot become negative",
        )

    # Product.stock_quantity stays the single figure sales validation relies
    # on, so keep it perfectly in step with the inventory adjustment.
    product.stock_quantity = new_current_stock
    product_repository.update(db, product)

    movement_type = ADJUSTMENT_TO_MOVEMENT[data.adjustment_type]
    audit_action = ADJUSTMENT_TO_AUDIT_ACTION[data.adjustment_type]

    return _apply_movement(
        db,
        inventory,
        product,
        new_current_stock,
        movement_type,
        data.reason,
        data.remarks,
        actor,
        ip_address,
        browser,
        audit_action=audit_action,
    )


def update_reorder_level(
    db: Session,
    product_id: int,
    company_id: int,
    data: ReorderLevelUpdate,
    actor: User,
    ip_address: str,
    browser: str,
) -> Inventory:
    product = product_repository.get_by_id_in_company(db, product_id, company_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    inventory = ensure_inventory_for_product(db, product)
    previous_status = inventory.stock_status

    inventory.reorder_level = data.reorder_level
    inventory.stock_status = compute_status(inventory.available_stock, inventory.reorder_level)
    inventory = inventory_repository.update(db, inventory)

    log_action(
        db,
        company_id=company_id,
        user_id=actor.id,
        action=AuditAction.REORDER_LEVEL_UPDATED,
        ip_address=ip_address,
        browser=browser,
        entity_name=product.name,
    )

    _notify_status_crossing(db, inventory, product, previous_status, actor, ip_address, browser)

    return inventory


def apply_sale_movement(
    db: Session,
    product: Product,
    quantity_deducted: int,
    actor: User,
    ip_address: str,
    browser: str,
) -> Inventory:
    """Called by the Sales module once it has already deducted `product.stock_quantity`."""
    inventory = ensure_inventory_for_product(db, product)
    return _apply_movement(
        db,
        inventory,
        product,
        product.stock_quantity,
        MovementType.SALE,
        reason="Sale",
        remarks=None,
        actor=actor,
        ip_address=ip_address,
        browser=browser,
        audit_action=AuditAction.INVENTORY_UPDATED,
    )


def apply_product_edit_stock_change(
    db: Session,
    product: Product,
    actor: User,
    ip_address: str,
    browser: str,
) -> Inventory:
    """Called by the Products module when stock_quantity is edited directly on a product."""
    inventory = ensure_inventory_for_product(db, product)
    return _apply_movement(
        db,
        inventory,
        product,
        product.stock_quantity,
        MovementType.MANUAL_ADJUSTMENT,
        reason="Product details updated",
        remarks=None,
        actor=actor,
        ip_address=ip_address,
        browser=browser,
        audit_action=AuditAction.STOCK_ADJUSTED,
    )


def sync_reorder_level_from_product(db: Session, product: Product) -> Inventory:
    inventory = ensure_inventory_for_product(db, product)
    inventory.reorder_level = product.low_stock_threshold or 0
    inventory.stock_status = compute_status(inventory.available_stock, inventory.reorder_level)
    return inventory_repository.update(db, inventory)


def apply_sale_reversal(
    db: Session,
    product: Product,
    actor: User,
    ip_address: str,
    browser: str,
) -> Inventory:
    """Called by the Sales module after it restores `product.stock_quantity` (sale update/delete)."""
    inventory = ensure_inventory_for_product(db, product)
    return _apply_movement(
        db,
        inventory,
        product,
        product.stock_quantity,
        MovementType.STOCK_ADDITION,
        reason="Sale reversed",
        remarks=None,
        actor=actor,
        ip_address=ip_address,
        browser=browser,
        audit_action=AuditAction.INVENTORY_UPDATED,
    )


def delete_for_product(db: Session, product_id: int) -> None:
    inventory_repository.delete_by_product_id(db, product_id)


def get_inventory(db: Session, product_id: int, company_id: int) -> Inventory:
    product = product_repository.get_by_id_in_company(db, product_id, company_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return ensure_inventory_for_product(db, product)


def list_inventory(
    db: Session,
    company_id: int,
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    stock_status: Optional[StockStatus] = None,
    brand: Optional[str] = None,
    sort_by: str = "updated",
) -> List[Inventory]:
    return inventory_repository.list_filtered(
        db,
        company_id=company_id,
        search=search,
        category_id=category_id,
        stock_status=stock_status,
        brand=brand,
        sort_by=sort_by,
    )


def list_movements(
    db: Session,
    company_id: int,
    product_id: Optional[int] = None,
):
    inventory_id = None
    if product_id is not None:
        inventory = inventory_repository.get_by_product_id(db, product_id, company_id)
        inventory_id = inventory.id if inventory else -1  # -1 => guaranteed empty result
    return inventory_repository.list_movements(db, company_id, inventory_id=inventory_id, product_id=None)


def serialize_movement(movement: InventoryMovement) -> dict:
    product = movement.inventory.product if movement.inventory else None
    return {
        "id": movement.id,
        "inventory_id": movement.inventory_id,
        "product_id": product.id if product else None,
        "product_name": product.name if product else None,
        "sku": product.sku if product else None,
        "movement_type": movement.movement_type,
        "quantity_changed": movement.quantity_changed,
        "previous_quantity": movement.previous_quantity,
        "updated_quantity": movement.updated_quantity,
        "reason": movement.reason,
        "remarks": movement.remarks,
        "performed_by": movement.performed_by,
        "performed_by_name": movement.performer.name if movement.performer else None,
        "created_at": movement.created_at,
    }


def dashboard_summary(db: Session, company_id: int) -> dict:
    return inventory_repository.dashboard_counts(db, company_id)


def charts(db: Session, company_id: int) -> dict:
    by_category = [
        {"category_id": cid, "category_name": name, "total_quantity": int(qty)}
        for cid, name, qty in inventory_repository.category_breakdown(db, company_id)
    ]
    by_stock_status = [
        {"stock_status": status_value, "count": count}
        for status_value, count in inventory_repository.stock_status_breakdown(db, company_id)
    ]
    return {"by_category": by_category, "by_stock_status": by_stock_status}
