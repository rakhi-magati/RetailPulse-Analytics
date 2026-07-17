from typing import List, Optional

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_company_id, get_current_user, require_roles
from app.core.enums import UserRole
from app.database.database import get_db
from app.models.user import User
from app.repositories import category_repository
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate
from app.services import category_service
from app.utils.request_meta import get_client_browser, get_client_ip

router = APIRouter(prefix="/categories", tags=["Categories"])

# Category Management is an Admin-only module.
AdminOnly = Depends(require_roles(UserRole.COMPANY_ADMIN))


@router.get("", response_model=List[CategoryOut])
def list_categories(
    search: Optional[str] = Query(None, description="Search categories by name"),
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=AdminOnly,
):
    """List all categories for the caller's company, with product counts, optionally filtered by name."""
    return category_service.list_categories(db, company_id, search)


@router.get("/{category_id}", response_model=CategoryOut)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=AdminOnly,
):
    category = category_service.get_category(db, category_id, company_id)
    out = CategoryOut.model_validate(category)
    out.product_count = category_repository.product_count(db, category.id)
    return out


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(
    payload: CategoryCreate,
    request: Request,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    current_user: User = Depends(get_current_user),
    _=AdminOnly,
):
    category = category_service.create_category(
        db,
        payload,
        company_id,
        actor=current_user,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )
    out = CategoryOut.model_validate(category)
    out.product_count = 0
    return out


@router.put("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    request: Request,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    current_user: User = Depends(get_current_user),
    _=AdminOnly,
):
    category = category_service.update_category(
        db,
        category_id,
        payload,
        company_id,
        actor=current_user,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )
    out = CategoryOut.model_validate(category)
    out.product_count = category_repository.product_count(db, category.id)
    return out


@router.delete("/{category_id}", status_code=204)
def delete_category(
    category_id: int,
    request: Request,
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    current_user: User = Depends(get_current_user),
    _=AdminOnly,
):
    category_service.delete_category(
        db,
        category_id,
        company_id,
        actor=current_user,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )
    return None
