from datetime import datetime, timezone

from fastapi import HTTPException, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
    refresh_token_expiry,
)
from app.auth.password import hash_password, verify_password
from app.core.enums import AuditAction, UserStatus
from app.models.company import Company
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.repositories import company_repository, user_repository
from app.services.audit_service import log_action


def register_company(db: Session, data):
    try:
        if company_repository.get_by_email(db, data.company_email):
            raise HTTPException(
                status_code=409,
                detail="Company email already exists",
            )

        if user_repository.get_by_email(db, data.owner_email):
            raise HTTPException(
                status_code=409,
                detail="User email already exists",
            )

        if data.password != data.confirm_password:
            raise HTTPException(
                status_code=400,
                detail="Passwords do not match",
            )

        new_company = Company(
            name=data.company_name,
            industry=data.industry,
            email=data.company_email,
            address=data.company_address,
            phone=data.company_phone,
        )

        db.add(new_company)
        db.commit()
        db.refresh(new_company)

        new_user = User(
            company_id=new_company.id,
            name=data.owner_name,
            email=data.owner_email,
            password=hash_password(data.password),
            role="COMPANY_ADMIN",
            status=UserStatus.ACTIVE,
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return {
            "success": True,
            "message": "Success"
        }

    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()   # 👈 prints full error in terminal
        raise HTTPException(status_code=500, detail=str(e))


def _issue_tokens(db: Session, user: User) -> dict:
    token_payload = {"sub": str(user.id), "company_id": user.company_id, "role": user.role.value if hasattr(user.role, "value") else user.role}

    access_token = create_access_token(token_payload)
    refresh_token = create_refresh_token(token_payload)

    db.add(
        RefreshToken(
            user_id=user.id,
            token=refresh_token,
            expires_at=refresh_token_expiry(),
        )
    )
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


def login(db: Session, email: str, password: str, ip_address: str, browser: str) -> dict:
    user = user_repository.get_by_email(db, email)

    if not user or not verify_password(password, user.password):
        if user:
            log_action(
                db,
                company_id=user.company_id,
                user_id=user.id,
                action=AuditAction.USER_LOGIN_FAILED,
                ip_address=ip_address,
                browser=browser,
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active. Contact your company admin.",
        )

    tokens = _issue_tokens(db, user)

    user.last_login = datetime.now(timezone.utc)
    db.commit()

    log_action(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action=AuditAction.USER_LOGIN,
        ip_address=ip_address,
        browser=browser,
    )

    return tokens


def refresh_access_token(db: Session, refresh_token: str) -> dict:
    try:
        payload = decode_token(refresh_token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    stored = (
        db.query(RefreshToken)
        .filter(RefreshToken.token == refresh_token)
        .first()
    )
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked",
        )

    if stored.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        db.delete(stored)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired, please log in again",
        )

    user_id = int(payload.get("sub"))
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is not active",
        )

    # Rotate: invalidate the old refresh token, issue a fresh pair
    db.delete(stored)
    db.commit()

    tokens = _issue_tokens(db, user)

    log_action(db, company_id=user.company_id, user_id=user.id, action=AuditAction.TOKEN_REFRESHED)

    return tokens


def logout(db: Session, user: User, refresh_token: str, ip_address: str, browser: str) -> dict:
    stored = (
        db.query(RefreshToken)
        .filter(RefreshToken.token == refresh_token, RefreshToken.user_id == user.id)
        .first()
    )
    if stored:
        db.delete(stored)
        db.commit()

    log_action(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action=AuditAction.USER_LOGOUT,
        ip_address=ip_address,
        browser=browser,
    )

    return {"success": True, "message": "Logged out successfully"}


def change_password(
    db: Session,
    user: User,
    current_password: str,
    new_password: str,
    confirm_new_password: str,
    ip_address: str,
    browser: str,
) -> dict:
    if not verify_password(current_password, user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters",
        )

    if new_password != confirm_new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New passwords do not match",
        )

    user.password = hash_password(new_password)
    db.commit()

    # Invalidate all existing refresh tokens so other sessions are logged out
    db.query(RefreshToken).filter(RefreshToken.user_id == user.id).delete()
    db.commit()

    log_action(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action=AuditAction.PASSWORD_CHANGED,
        ip_address=ip_address,
        browser=browser,
    )

    return {"success": True, "message": "Password changed successfully"}
