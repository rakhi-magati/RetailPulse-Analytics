from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.enums import CategoryStatus


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    status: CategoryStatus = CategoryStatus.ACTIVE

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Category name is mandatory")
        return v


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[CategoryStatus] = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Category name is mandatory")
        return v


class CategoryOut(BaseModel):
    id: int
    company_id: int
    name: str
    description: Optional[str] = None
    status: CategoryStatus
    created_at: datetime
    updated_at: Optional[datetime] = None
    product_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class CategoryBrief(BaseModel):
    id: int
    name: str
    status: CategoryStatus

    model_config = ConfigDict(from_attributes=True)
