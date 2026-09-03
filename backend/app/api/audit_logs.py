import csv
import io
from datetime import datetime
from math import ceil
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_company_id, require_roles
from app.core.enums import UserRole
from app.database.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit_log import AuditLogDetail, AuditLogPage, AuditLogOut

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])
AdminOnly = Depends(require_roles(UserRole.COMPANY_ADMIN))


def _query_logs(db: Session, company_id: int, user_id: Optional[int] = None, action: Optional[str] = None,
                resource_type: Optional[str] = None, status: Optional[str] = None,
                start_date: Optional[datetime] = None, end_date: Optional[datetime] = None,
                search: Optional[str] = None):
    query = db.query(AuditLog).options(joinedload(AuditLog.user)).filter(AuditLog.company_id == company_id)
    if user_id is not None: query = query.filter(AuditLog.user_id == user_id)
    if action: query = query.filter(AuditLog.action == action)
    if resource_type: query = query.filter(AuditLog.resource_type == resource_type)
    if status: query = query.filter(AuditLog.status == status)
    if start_date: query = query.filter(AuditLog.created_at >= start_date)
    if end_date: query = query.filter(AuditLog.created_at <= end_date)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.join(AuditLog.user).filter(or_(User.name.ilike(term), User.email.ilike(term), AuditLog.action.ilike(term), AuditLog.resource_type.ilike(term), cast(AuditLog.resource_id, String).ilike(term), AuditLog.entity_name.ilike(term), AuditLog.description.ilike(term)))
    return query


def _serialize(log: AuditLog, detail: bool = False) -> dict:
    data = {"id": log.id, "user_id": log.user_id, "user_name": log.user.name if log.user else "Unknown user",
            "user_email": log.user.email if log.user else "", "action": log.action, "resource_type": log.resource_type,
            "resource_id": log.resource_id, "description": log.description, "entity_name": log.entity_name,
            "ip_address": log.ip_address, "user_agent": log.user_agent or log.browser, "status": log.status,
            "created_at": log.created_at}
    if detail: data.update({"before_values": log.before_values, "after_values": log.after_values})
    return data


@router.get("", response_model=AuditLogPage)
def list_audit_logs(
    page: int = Query(1, ge=1), limit: int = Query(25, ge=1, le=100), user_id: Optional[int] = None,
    action: Optional[str] = None, resource_type: Optional[str] = None, status: Optional[str] = None,
    start_date: Optional[datetime] = None, end_date: Optional[datetime] = None, search: Optional[str] = Query(None, max_length=200),
    sort: Literal["newest", "oldest"] = "newest", db: Session = Depends(get_db),
    company_id: int = Depends(get_current_company_id), _=AdminOnly,
):
    query = _query_logs(db, company_id, user_id, action, resource_type, status, start_date, end_date, search)
    total = query.count()
    order = AuditLog.created_at.asc() if sort == "oldest" else AuditLog.created_at.desc()
    items = query.order_by(order, AuditLog.id.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"items": [_serialize(item) for item in items], "total": total, "page": page, "limit": limit, "total_pages": ceil(total / limit) if total else 0}


@router.get("/by-id/{log_id}", response_model=AuditLogDetail)
def get_audit_log(log_id: int, db: Session = Depends(get_db), company_id: int = Depends(get_current_company_id), _=AdminOnly):
    log = db.query(AuditLog).options(joinedload(AuditLog.user)).filter(AuditLog.id == log_id, AuditLog.company_id == company_id).first()
    if not log: raise HTTPException(status_code=404, detail="Audit log not found")
    return _serialize(log, detail=True)


@router.get("/export/csv")
def export_csv(user_id: Optional[int] = None, action: Optional[str] = None, resource_type: Optional[str] = None,
               status: Optional[str] = None, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None,
               search: Optional[str] = None, db: Session = Depends(get_db), company_id: int = Depends(get_current_company_id), _=AdminOnly):
    logs = _query_logs(db, company_id, user_id, action, resource_type, status, start_date, end_date, search).order_by(AuditLog.created_at.desc()).all()
    output = io.StringIO(); writer = csv.writer(output); writer.writerow(["ID", "User", "Email", "Action", "Resource", "Resource ID", "Description", "IP address", "Timestamp", "Status"])
    for log in logs:
        row = _serialize(log); writer.writerow([row["id"], row["user_name"], row["user_email"], row["action"], row["resource_type"] or row["entity_name"] or "", row["resource_id"] or "", row["description"] or "", row["ip_address"] or "", row["created_at"].isoformat() if row["created_at"] else "", row["status"]])
    return Response(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=audit-logs.csv"})


@router.get("/export/pdf")
def export_pdf(user_id: Optional[int] = None, action: Optional[str] = None, resource_type: Optional[str] = None,
               status: Optional[str] = None, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None,
               search: Optional[str] = None, db: Session = Depends(get_db), company_id: int = Depends(get_current_company_id), _=AdminOnly):
    from reportlab.lib.pagesizes import landscape, letter
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas
    logs = _query_logs(db, company_id, user_id, action, resource_type, status, start_date, end_date, search).order_by(AuditLog.created_at.desc()).all()
    buffer = io.BytesIO(); pdf = canvas.Canvas(buffer, pagesize=landscape(letter)); width, height = landscape(letter); y = height - 36
    pdf.setFont("Helvetica-Bold", 14); pdf.drawString(36, y, "RetailPulse Audit Logs"); y -= 24; pdf.setFont("Helvetica", 8)
    for log in logs:
        row = _serialize(log); text = f"{row['created_at']} | {row['user_name']} | {row['action']} | {row['resource_type'] or row['entity_name'] or '-'} #{row['resource_id'] or '-'} | {row['description'] or ''}"
        if y < 36: pdf.showPage(); y = height - 36; pdf.setFont("Helvetica", 8)
        pdf.drawString(36, y, text[:180]); y -= 13
    pdf.save()
    return Response(buffer.getvalue(), media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=audit-logs.pdf"})
