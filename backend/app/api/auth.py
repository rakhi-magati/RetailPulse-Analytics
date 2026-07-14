from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database.database import get_db
from app.models.user import User
from app.schemas.auth import (
    CompanyRegisterSchema,
    LoginSchema,
    MessageResponse,
    RefreshTokenSchema,
    TokenResponse,
)
from app.schemas.user import ChangePasswordSchema, UserProfileResponse
from app.services import auth_service
from app.utils.request_meta import get_client_browser, get_client_ip

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=None)
def register(data: CompanyRegisterSchema, db: Session = Depends(get_db)):
    return auth_service.register_company(db, data)


@router.post("/login", response_model=TokenResponse)
def login(data: LoginSchema, request: Request, db: Session = Depends(get_db)):
    return auth_service.login(
        db,
        email=data.email,
        password=data.password,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: RefreshTokenSchema, db: Session = Depends(get_db)):
    return auth_service.refresh_access_token(db, data.refresh_token)


@router.post("/logout", response_model=MessageResponse)
def logout(
    data: RefreshTokenSchema,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return auth_service.logout(
        db,
        user=current_user,
        refresh_token=data.refresh_token,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )


@router.get("/me", response_model=UserProfileResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    data: ChangePasswordSchema,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return auth_service.change_password(
        db,
        user=current_user,
        current_password=data.current_password,
        new_password=data.new_password,
        confirm_new_password=data.confirm_new_password,
        ip_address=get_client_ip(request),
        browser=get_client_browser(request),
    )
