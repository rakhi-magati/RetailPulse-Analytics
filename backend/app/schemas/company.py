from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class CompanyOut(BaseModel):
    id: int
    name: str
    industry: str
    email: EmailStr
    address: str
    phone: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
