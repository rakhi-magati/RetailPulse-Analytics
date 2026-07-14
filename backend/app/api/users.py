from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_company_id, require_roles
from app.core.enums import UserRole
from app.database.database import get_db
from app.repositories import user_repository
from app.schemas.user import UserProfileResponse

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=List[UserProfileResponse])
def list_company_users(
    db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id),
    _=Depends(require_roles(UserRole.COMPANY_ADMIN)),
):
    """
    Returns only the users belonging to the caller's own company.
    company_id is derived from the JWT, never from the client, so
    there is no way to pass someone else's company id here.
    """
    return user_repository.list_by_company(db, company_id)
