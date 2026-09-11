from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import NotificationPriority, NotificationType


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: Optional[int] = None
    product_id: Optional[int] = None
    type: NotificationType
    title: str
    message: str
    priority: NotificationPriority
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    payload: Optional[dict[str, Any]] = None
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class NotificationPage(BaseModel):
    items: list[NotificationOut]
    total: int
    page: int = Field(ge=1)
    limit: int = Field(ge=1, le=100)
    total_pages: int


class UnreadNotificationCount(BaseModel):
    count: int


class MarkAllReadResult(BaseModel):
    updated: int