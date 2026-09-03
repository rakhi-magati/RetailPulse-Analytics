from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    user_name: str
    user_email: str
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    description: Optional[str] = None
    entity_name: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    status: str
    created_at: datetime


class AuditLogDetail(AuditLogOut):
    before_values: Optional[dict[str, Any]] = None
    after_values: Optional[dict[str, Any]] = None


class AuditLogPage(BaseModel):
    items: list[AuditLogOut]
    total: int
    page: int = Field(ge=1)
    limit: int = Field(ge=1, le=100)
    total_pages: int
