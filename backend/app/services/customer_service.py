from datetime import datetime, timezone
from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from app.models.customer import Customer, CustomerPurchaseSummary, CustomerTimeline
from app.models.sale import Sale, SaleItem
from app.models.notification import Notification
from app.models.user import User
from app.core.enums import AuditAction, NotificationType
from app.services.audit_service import log_action

def _summary(db, customer):
    sales = db.query(Sale).filter(Sale.company_id == customer.company_id, Sale.customer_id == customer.id).order_by(Sale.sale_date).all()
    revenue = sum((Decimal(str(s.total_amount)) for s in sales), Decimal('0'))
    quantity = sum((i.quantity for s in sales for i in s.items), 0)
    first, last = (sales[0].sale_date, sales[-1].sale_date) if sales else (None, None)
    frequency = Decimal('0')
    if first and last:
        frequency = Decimal(len(sales)) / Decimal(max((last.date()-first.date()).days / 30, 1))
    summary = customer.summary or CustomerPurchaseSummary(customer_id=customer.id)
    summary.total_orders, summary.total_revenue, summary.total_products_purchased = len(sales), revenue, quantity
    summary.average_order_value = revenue / len(sales) if sales else Decimal('0')
    summary.purchase_frequency, summary.first_purchase_date, summary.last_purchase_date = frequency, first, last
    if not customer.summary: db.add(summary)
    db.flush()
    product_row = db.query(SaleItem.product_id, func.count(SaleItem.id).label('n')).join(Sale).filter(Sale.customer_id==customer.id).group_by(SaleItem.product_id).order_by(func.count(SaleItem.id).desc()).first()
    category_row = db.query(SaleItem.category_id, func.count(SaleItem.id).label('n')).join(Sale).filter(Sale.customer_id==customer.id).group_by(SaleItem.category_id).order_by(func.count(SaleItem.id).desc()).first()
    summary.favorite_product_id = product_row[0] if product_row else None; summary.favorite_category_id = category_row[0] if category_row else None
    return summary

def _segment(s):
    if s.total_revenue >= 10000 or s.total_orders >= 20: return 'VIP_CUSTOMER'
    if s.total_orders >= 8: return 'LOYAL_CUSTOMER'
    if s.total_orders >= 2: return 'REGULAR_CUSTOMER'
    return 'NEW_CUSTOMER'

def serialize(db, customer, detail=False):
    s = _summary(db, customer)
    result = {c.name: getattr(customer,c.name) for c in Customer.__table__.columns}
    result.update({k:getattr(s,k) for k in ('total_orders','total_revenue','total_products_purchased','average_order_value','purchase_frequency','first_purchase_date','last_purchase_date')}); result['segment']=_segment(s)
    if detail:
        from app.models.product import Product
        from app.models.category import Category
        result['favorite_product'] = db.get(Product,s.favorite_product_id).name if s.favorite_product_id and db.get(Product,s.favorite_product_id) else None
        result['favorite_category'] = db.get(Category,s.favorite_category_id).name if s.favorite_category_id and db.get(Category,s.favorite_category_id) else None
        result['recent_transactions']=[{'id':x.id,'invoice_number':x.invoice_number,'date':x.sale_date,'amount':x.total_amount,'payment_method':x.payment_method} for x in db.query(Sale).filter(Sale.customer_id==customer.id).order_by(Sale.sale_date.desc()).limit(10)]
        result['timeline']=[{'event_type':x.event_type,'description':x.description,'created_at':x.created_at} for x in db.query(CustomerTimeline).filter(CustomerTimeline.customer_id==customer.id).order_by(CustomerTimeline.created_at.desc()).limit(30)]
    return result

def create(db, data, company_id, actor, ip, browser):
    if db.query(Customer).filter(Customer.company_id==company_id, or_(Customer.email==data.email,Customer.phone==data.phone)).first(): raise HTTPException(409,'Email or phone is already registered for this company')
    customer = Customer(company_id=company_id, customer_id=f'CUST-{datetime.now(timezone.utc).year}-{(db.query(Customer).filter(Customer.company_id==company_id).count()+1):06d}', **data.model_dump())
    db.add(customer); db.flush(); db.add(CustomerTimeline(customer_id=customer.id,event_type='REGISTERED',description='Customer registered'))
    db.add(Notification(company_id=company_id, type=NotificationType.CUSTOMER_REGISTERED, message=f'New customer registered: {customer.full_name}'))
    log_action(db, company_id=company_id, user_id=actor.id, action=AuditAction.CUSTOMER_CREATED, ip_address=ip, browser=browser, entity_name=customer.full_name); db.commit(); db.refresh(customer); return customer

def get(db,id,company):
    c=db.query(Customer).filter(Customer.id==id,Customer.company_id==company).first()
    if not c: raise HTTPException(404,'Customer not found')
    return c

def update(db,id,data,company,actor,ip,browser):
    c=get(db,id,company); changes=data.model_dump(exclude_unset=True)
    if any(k in changes for k in ('email','phone')):
        q=db.query(Customer).filter(Customer.company_id==company,Customer.id!=id)
        if ('email' in changes and q.filter(Customer.email==changes['email']).first()) or ('phone' in changes and q.filter(Customer.phone==changes['phone']).first()): raise HTTPException(409,'Email or phone is already registered for this company')
    prior=c.status
    for k,v in changes.items(): setattr(c,k,v)
    event='PROFILE_UPDATED' if prior==c.status else ('REACTIVATED' if c.status=='ACTIVE' else 'DEACTIVATED')
    db.add(CustomerTimeline(customer_id=id,event_type=event,description=f'Customer {event.lower().replace("_"," ")}'))
    log_action(db, company_id=company, user_id=actor.id, action=AuditAction.CUSTOMER_UPDATED if prior==c.status else (AuditAction.CUSTOMER_ACTIVATED if c.status=='ACTIVE' else AuditAction.CUSTOMER_DEACTIVATED), ip_address=ip, browser=browser, entity_name=c.full_name); db.commit(); return c

def delete(db,id,company,actor,ip,browser):
    c=get(db,id,company)
    if db.query(Sale).filter(Sale.customer_id==id).count(): raise HTTPException(400,'Customers with recorded sales cannot be deleted; deactivate them instead')
    name=c.full_name; db.delete(c); log_action(db, company_id=company, user_id=actor.id, action=AuditAction.CUSTOMER_DELETED, ip_address=ip, browser=browser, entity_name=name); db.commit()
