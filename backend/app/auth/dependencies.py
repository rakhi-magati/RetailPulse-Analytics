from typing import Iterable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.orm import Session

from app.auth.jwt import decode_token
from app.core.enums import UserRole, UserStatus
from app.database.database import get_db
from app.models.user import User


# HTTP Bearer Authentication
security = HTTPBearer()


CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """
    Validate JWT token and return current user.
    """

    if credentials is None:
        raise CREDENTIALS_EXCEPTION

    token = credentials.credentials

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


def get_current_company_id(
    current_user: User = Depends(get_current_user),
) -> int:
    return current_user.company_id


def require_roles(*allowed_roles: Iterable[UserRole]):
    def _check(current_user: User = Depends(get_current_user)):

        if current_user.role == UserRole.SUPER_ADMIN:
            return current_user

        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )

        return current_user

    return _check