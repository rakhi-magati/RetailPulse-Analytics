from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.enums import AuditAction
from app.models.category import Category
from app.models.user import User
from app.repositories import category_repository
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate
from app.services.audit_service import log_action


def list_categories(db: Session, company_id: int, search: Optional[str] = None) -> List[CategoryOut]:
    rows = category_repository.list_with_product_counts(db, company_id, search)
    results = []
    for category, count in rows:
        item = CategoryOut.model_validate(category)
        item.product_count = count
        results.append(item)
    return results


def get_category(db: Session, category_id: int, company_id: int) -> Category:
    category = category_repository.get_by_id_in_company(db, category_id, company_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return category


def create_category(
    db: Session,
    data: CategoryCreate,
    company_id: int,
    actor: User,
    ip_address: str,
    browser: str,
) -> Category:
    if category_repository.get_by_name_in_company(db, data.name, company_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A category with this name already exists",
        )

    category = Category(
        company_id=company_id,
        name=data.name,
        description=data.description,
        status=data.status,
    )
    category = category_repository.create(db, category)

    log_action(
        db,
        company_id=company_id,
        user_id=actor.id,
        action=AuditAction.CATEGORY_CREATED,
        ip_address=ip_address,
        browser=browser,
        entity_name=category.name,
    )
    return category


def update_category(
    db: Session,
    category_id: int,
    data: CategoryUpdate,
    company_id: int,
    actor: User,
    ip_address: str,
    browser: str,
) -> Category:
    category = get_category(db, category_id, company_id)

    if data.name is not None and data.name.strip().lower() != category.name.strip().lower():
        if category_repository.get_by_name_in_company(db, data.name, company_id, exclude_id=category.id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A category with this name already exists",
            )
        category.name = data.name

    if data.description is not None:
        category.description = data.description

    if data.status is not None:
        category.status = data.status

    category = category_repository.update(db, category)

    log_action(
        db,
        company_id=company_id,
        user_id=actor.id,
        action=AuditAction.CATEGORY_UPDATED,
        ip_address=ip_address,
        browser=browser,
        entity_name=category.name,
    )
    return category


def delete_category(
    db: Session,
    category_id: int,
    company_id: int,
    actor: User,
    ip_address: str,
    browser: str,
) -> None:
    category = get_category(db, category_id, company_id)

    linked_products = category_repository.product_count(db, category.id)
    if linked_products > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot delete category '{category.name}': {linked_products} product(s) "
                "are still assigned to it. Reassign or delete those products first."
            ),
        )

    name = category.name
    category_repository.delete(db, category)

    log_action(
        db,
        company_id=company_id,
        user_id=actor.id,
        action=AuditAction.CATEGORY_DELETED,
        ip_address=ip_address,
        browser=browser,
        entity_name=name,
    )
