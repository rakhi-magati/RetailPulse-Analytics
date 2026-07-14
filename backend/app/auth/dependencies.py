from typing import Iterable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.auth.jwt import decode_token
from app.core.enums import UserRole, UserStatus
from app.database.database import get_db
from app.models.user import User

# tokenUrl is only used for the OpenAPI docs "Authorize" button
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Decodes the JWT access token, loads the user, and enforces that
    the account is still active. This is the single choke point that
    every protected route depends on.
    """
    if not token:
        raise CREDENTIALS_EXCEPTION

    try:
        payload = decode_token(token)
    except JWTError:
        raise CREDENTIALS_EXCEPTION

    if payload.get("type") != "access":
        raise CREDENTIALS_EXCEPTION

    user_id = payload.get("sub")
    if user_id is None:
        raise CREDENTIALS_EXCEPTION

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise CREDENTIALS_EXCEPTION

    if user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not active. Contact your company admin.",
        )

    return user


def get_current_company_id(current_user: User = Depends(get_current_user)) -> int:
    """
    Every data-access endpoint should depend on this (directly or
    indirectly) and filter its query by this company_id. This is the
    mechanism that guarantees multi-tenant isolation: Company A's
    token can never resolve to Company B's id.
    Super Admins are the only exception (cross-company by design).
    """
    return current_user.company_id


def require_roles(*allowed_roles: Iterable[UserRole]):
    """
    Dependency factory for role-based authorization, e.g.:
        Depends(require_roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN))
    """

    def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role == UserRole.SUPER_ADMIN:
            # Super Admin bypasses per-route role checks
            return current_user

        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return _check
