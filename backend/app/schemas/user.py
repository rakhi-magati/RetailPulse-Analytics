from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr

from app.core.enums import UserRole, UserStatus


class CompanyBrief(BaseModel):
    id: int
    name: str
    industry: str

    model_config = ConfigDict(from_attributes=True)


class UserProfileResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: UserRole
    status: UserStatus
    last_login: Optional[datetime] = None
    created_at: datetime
    company: CompanyBrief

    model_config = ConfigDict(from_attributes=True)


class ChangePasswordSchema(BaseModel):
    current_password: str
    new_password: str
    confirm_new_password: str
