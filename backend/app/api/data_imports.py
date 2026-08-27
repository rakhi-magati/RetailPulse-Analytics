import csv, io
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.auth.dependencies import get_current_company_id, get_current_user, require_roles
from app.core.enums import UserRole
from app.database.database import get_db
from app.models.data_import import DataImport
from app.models.user import User
from app.schemas.data_import import ImportOut
from app.services import data_import_service

router=APIRouter(prefix="/imports",tags=["Data Imports"])
AdminOnly=Depends(require_roles(UserRole.COMPANY_ADMIN))

@router.post("/upload",response_model=ImportOut,status_code=201)
async def upload(import_type:str,file:UploadFile=File(...),db:Session=Depends(get_db),company_id:int=Depends(get_current_company_id),user:User=Depends(get_current_user),_=AdminOnly):
    if not file.filename or not file.filename.lower().endswith(".csv"): raise HTTPException(422,"Only .csv files are supported")
    try: source=(await file.read()).decode("utf-8-sig")
    except UnicodeDecodeError: raise HTTPException(422,"CSV must use UTF-8 encoding")
    return data_import_service.upload(db,company_id,user.id,import_type,file.filename,source)

@router.post("/{job_id}/process",response_model=ImportOut)
def process(job_id:int,db:Session=Depends(get_db),company_id:int=Depends(get_current_company_id),_=AdminOnly): return data_import_service.process(db,company_id,job_id)

@router.get("/history",response_model=list[ImportOut])
def history(db:Session=Depends(get_db),company_id:int=Depends(get_current_company_id),_=AdminOnly): return [data_import_service.serialize(x) for x in db.query(DataImport).filter(DataImport.company_id==company_id).order_by(DataImport.created_at.desc()).all()]

@router.get("/{job_id}",response_model=ImportOut)
def detail(job_id:int,db:Session=Depends(get_db),company_id:int=Depends(get_current_company_id),_=AdminOnly): return data_import_service.serialize(data_import_service.get_job(db,company_id,job_id))

@router.get("/{job_id}/errors")
def errors(job_id:int,db:Session=Depends(get_db),company_id:int=Depends(get_current_company_id),_=AdminOnly):
    job=data_import_service.get_job(db,company_id,job_id); stream=io.StringIO(); writer=csv.writer(stream); writer.writerow(["row_number","type","message","row_data"])
    for e in job.errors: writer.writerow([e.row_number,e.error_type,e.message,e.row_data])
    return StreamingResponse(iter([stream.getvalue()]),media_type="text/csv",headers={"Content-Disposition":f'attachment; filename="import-{job_id}-errors.csv"'})
