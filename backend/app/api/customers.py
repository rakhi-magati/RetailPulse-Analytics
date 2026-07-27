from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.auth.dependencies import get_current_company_id, get_current_user, require_roles
from app.core.enums import UserRole, AuditAction
from app.database.database import get_db
from app.models.customer import Customer
from app.models.sale import Sale
from app.models.user import User
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerOut, CustomerDetail, CustomerDashboard
from app.services import customer_service
from app.services.audit_service import log_action
from app.utils.request_meta import get_client_ip, get_client_browser
router=APIRouter(prefix='/customers',tags=['Customers'])
Access=Depends(require_roles(UserRole.COMPANY_ADMIN,UserRole.ANALYST))

@router.get('',response_model=list[CustomerOut])
def list_customers(search:Optional[str]=None, customer_type:Optional[str]=None,status:Optional[str]=None,city:Optional[str]=None,state:Optional[str]=None,country:Optional[str]=None,registered_from:Optional[datetime]=None,registered_to:Optional[datetime]=None,sort_by:str='name',sort_dir:str='asc',db:Session=Depends(get_db),company_id:int=Depends(get_current_company_id),_=Access):
 q=db.query(Customer).filter(Customer.company_id==company_id)
 if search: q=q.filter((Customer.full_name.ilike(f'%{search}%'))|(Customer.customer_id.ilike(f'%{search}%'))|(Customer.email.ilike(f'%{search}%'))|(Customer.phone.ilike(f'%{search}%')))
 for field,value in ((Customer.customer_type,customer_type),(Customer.status,status),(Customer.city,city),(Customer.state,state),(Customer.country,country)):
  if value: q=q.filter(field==value)
 if registered_from:q=q.filter(Customer.created_at>=registered_from)
 if registered_to:q=q.filter(Customer.created_at<=registered_to)
 column={'name':Customer.full_name,'customer_since':Customer.created_at,'total_spend':Customer.id,'total_orders':Customer.id,'last_purchase':Customer.id}.get(sort_by,Customer.full_name)
 rows=q.order_by(column.desc() if sort_dir=='desc' else column.asc()).all(); result=[customer_service.serialize(db,c) for c in rows]
 if sort_by in ('total_spend','total_orders','last_purchase'): result.sort(key=lambda x:x['total_revenue'] if sort_by=='total_spend' else x['total_orders'] if sort_by=='total_orders' else x['last_purchase_date'] or datetime.min.replace(tzinfo=timezone.utc),reverse=sort_dir=='desc')
 db.commit(); return result
@router.post('',response_model=CustomerOut,status_code=201)
def create(data:CustomerCreate,request:Request,db:Session=Depends(get_db),company_id:int=Depends(get_current_company_id),user:User=Depends(get_current_user),_=Access): return customer_service.serialize(db,customer_service.create(db,data,company_id,user,get_client_ip(request),get_client_browser(request)))
@router.get('/analytics',response_model=CustomerDashboard)
def analytics(db:Session=Depends(get_db),company_id:int=Depends(get_current_company_id),_=Access):
 customers=db.query(Customer).filter(Customer.company_id==company_id).all(); rows=[customer_service.serialize(db,c) for c in customers]; now=datetime.now(timezone.utc); month=now.replace(day=1,hour=0,minute=0,second=0,microsecond=0)
 revenue=sum((Decimal(str(x['total_revenue'])) for x in rows),Decimal('0')); orders=sum(x['total_orders'] for x in rows)
 types={}; locations={}; spending={'No purchases':0,'Low (< $500)':0,'Medium ($500-$2k)':0,'High ($2k+)':0}
 for x in rows:
  types[x['customer_type']]=types.get(x['customer_type'],Decimal('0'))+Decimal(str(x['total_revenue'])); locations[x['country'] or 'Unspecified']=locations.get(x['country'] or 'Unspecified',0)+1
  spending['No purchases' if not x['total_orders'] else 'Low (< $500)' if x['total_revenue']<500 else 'Medium ($500-$2k)' if x['total_revenue']<2000 else 'High ($2k+)']+=1
 growth=[]
 for offset in range(5,-1,-1):
  start=(month.replace(day=1)-timedelta(days=offset*30)).replace(day=1); end=(start+timedelta(days=32)).replace(day=1); growth.append({'month':start.strftime('%b %Y'),'customers':sum(1 for x in rows if start<=x['created_at']<end)})
 db.commit(); return {'total_customers':len(rows),'active_customers':sum(x['status']=='ACTIVE' for x in rows),'new_customers':sum(x['created_at']>=month for x in rows),'returning_customers':sum(x['total_orders']>1 for x in rows),'average_customer_spend':revenue/len(rows) if rows else 0,'total_revenue':revenue,'average_purchase_frequency':sum((Decimal(str(x['purchase_frequency'])) for x in rows),Decimal('0'))/len(rows) if rows else 0,'growth':growth,'revenue_by_type':[{'name':k,'value':v} for k,v in types.items()],'top_customers':sorted([{'name':x['full_name'],'revenue':x['total_revenue'],'orders':x['total_orders'],'segment':x['segment']} for x in rows],key=lambda x:x['revenue'],reverse=True)[:10],'location_distribution':[{'name':k,'value':v} for k,v in locations.items()],'spending_distribution':[{'name':k,'value':v} for k,v in spending.items()]}
@router.get('/{customer_id}',response_model=CustomerDetail)
def detail(customer_id:int,db:Session=Depends(get_db),company_id:int=Depends(get_current_company_id),_=Access):
 result=customer_service.serialize(db,customer_service.get(db,customer_id,company_id),True); db.commit(); return result
@router.put('/{customer_id}',response_model=CustomerOut)
def update(customer_id:int,data:CustomerUpdate,request:Request,db:Session=Depends(get_db),company_id:int=Depends(get_current_company_id),user:User=Depends(get_current_user),_=Access): return customer_service.serialize(db,customer_service.update(db,customer_id,data,company_id,user,get_client_ip(request),get_client_browser(request)))
@router.delete('/{customer_id}',status_code=204)
def delete(customer_id:int,request:Request,db:Session=Depends(get_db),company_id:int=Depends(get_current_company_id),user:User=Depends(get_current_user),_=Access): customer_service.delete(db,customer_id,company_id,user,get_client_ip(request),get_client_browser(request))
@router.get('/export/csv')
def export_csv(db:Session=Depends(get_db),company_id:int=Depends(get_current_company_id),user:User=Depends(get_current_user),_=Access):
 import csv,io
 out=io.StringIO(); w=csv.writer(out); w.writerow(['Customer ID','Name','Email','Phone','Type','Status','Orders','Revenue','Segment'])
 for c in db.query(Customer).filter(Customer.company_id==company_id): x=customer_service.serialize(db,c); w.writerow([x['customer_id'],x['full_name'],x['email'],x['phone'],x['customer_type'],x['status'],x['total_orders'],x['total_revenue'],x['segment']])
 log_action(db,company_id=company_id,user_id=user.id,action=AuditAction.CUSTOMER_EXPORTED,entity_name='Customer CSV'); return Response(out.getvalue(),media_type='text/csv',headers={'Content-Disposition':'attachment; filename=customers.csv'})
