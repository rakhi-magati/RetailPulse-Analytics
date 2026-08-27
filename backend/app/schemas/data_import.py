from datetime import datetime
from typing import Any
from pydantic import BaseModel

class ImportErrorOut(BaseModel):
    row_number: int
    row_data: dict[str, Any]
    error_type: str
    message: str

class ImportOut(BaseModel):
    id: int
    import_type: str
    filename: str
    status: str
    total_records: int
    valid_records: int
    successful_records: int
    failed_records: int
    duplicate_records: int
    columns: list[str] = []
    preview: list[dict[str, Any]] = []
    errors: list[ImportErrorOut] = []
    created_at: datetime | None = None
    completed_at: datetime | None = None
    uploaded_by_name: str | None = None
