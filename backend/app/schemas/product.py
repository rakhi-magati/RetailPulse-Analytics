from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.enums import ProductStatus, UnitOfMeasure
from app.schemas.category import CategoryBrief


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    sku: str = Field(..., min_length=1, max_length=100)
    category_id: int
    brand: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    unit_price: Decimal = Field(..., gt=0)
    cost_price: Decimal = Field(..., ge=0)
    stock_quantity: int = Field(0, ge=0)
    unit_of_measure: UnitOfMeasure = UnitOfMeasure.PCS
    status: ProductStatus = ProductStatus.ACTIVE

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Product name is mandatory")
        return v

    @field_validator("sku")
    @classmethod
    def sku_must_not_be_blank(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("SKU is mandatory")
        return v

    @model_validator(mode="after")
    def cost_cannot_exceed_unit_price(self):
        if self.cost_price is not None and self.unit_price is not None:
            if self.cost_price > self.unit_price:
                raise ValueError("Cost Price cannot exceed Unit Price")
        return self


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    sku: Optional[str] = Field(None, min_length=1, max_length=100)
    category_id: Optional[int] = None
    brand: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    unit_price: Optional[Decimal] = Field(None, gt=0)
    cost_price: Optional[Decimal] = Field(None, ge=0)
    stock_quantity: Optional[int] = Field(None, ge=0)
    unit_of_measure: Optional[UnitOfMeasure] = None
    status: Optional[ProductStatus] = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Product name is mandatory")
        return v

    @field_validator("sku")
    @classmethod
    def sku_must_not_be_blank(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip().upper()
        if not v:
            raise ValueError("SKU is mandatory")
        return v

    @model_validator(mode="after")
    def cost_cannot_exceed_unit_price(self):
        if self.cost_price is not None and self.unit_price is not None:
            if self.cost_price > self.unit_price:
                raise ValueError("Cost Price cannot exceed Unit Price")
        return self


class ProductOut(BaseModel):
    id: int
    company_id: int
    category_id: int
    name: str
    sku: str
    brand: Optional[str] = None
    description: Optional[str] = None
    unit_price: Decimal
    cost_price: Decimal
    stock_quantity: int
    unit_of_measure: UnitOfMeasure
    status: ProductStatus
    created_at: datetime
    updated_at: Optional[datetime] = None
    category: Optional[CategoryBrief] = None

    model_config = ConfigDict(from_attributes=True)


class ProductStatusUpdate(BaseModel):
    status: ProductStatus


class DashboardSummary(BaseModel):
    total_products: int
    active_products: int
    inactive_products: int
    total_categories: int
