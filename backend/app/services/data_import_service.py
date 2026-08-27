"""CSV import pipeline. Validation is performed before processing; unexpected errors roll back the complete batch."""
import csv, io, json, re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.enums import ProductStatus, UnitOfMeasure
from app.models.category import Category
from app.models.customer import Customer
from app.models.data_import import DataImport, DataImportError
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.sale import Sale, SaleItem

MAX_BYTES = 5 * 1024 * 1024
REQUIRED = {"PRODUCTS": {"product_name","sku","category","unit_price","stock_quantity"}, "CUSTOMERS": {"name","email","phone"}, "SALES": {"customer","product","quantity","unit_price","sale_date"}}

def _key(v): return re.sub(r"[^a-z0-9]+", "_", v.strip().lower()).strip("_")
def parse(source):
    reader = csv.DictReader(io.StringIO(source))
    if not reader.fieldnames: raise HTTPException(422, "CSV must include a header row")
    columns = [_key(x) for x in reader.fieldnames]
    return columns, [{_key(k):(v or "").strip() for k,v in row.items()} for row in reader]
def error(n,row,message,kind="INVALID"): return {"row_number":n,"row_data":row,"error_type":kind,"message":message}

def validate(db, company_id, import_type, source):
    columns, rows = parse(source); import_type = import_type.upper()
    if import_type not in REQUIRED: raise HTTPException(422, "Import type must be PRODUCTS, CUSTOMERS, or SALES")
    missing = REQUIRED[import_type] - set(columns)
    if missing: raise HTTPException(422, f"Missing required columns: {', '.join(sorted(missing))}")
    problems=[]; seen=set(); seen_phones=set()
    for n,row in enumerate(rows,2):
        if import_type == "PRODUCTS":
            sku=row["sku"].upper()
            if not row["product_name"] or not sku or not row["category"]: problems.append(error(n,row,"Product name, SKU, and category are required")); continue
            try:
                if Decimal(row["unit_price"])<=0 or int(row["stock_quantity"])<0: raise ValueError
            except (InvalidOperation,ValueError): problems.append(error(n,row,"Unit price must be positive and stock cannot be negative")); continue
            duplicate = sku in seen or db.query(Product.id).filter(Product.company_id==company_id,func.upper(Product.sku)==sku).first()
            if duplicate: problems.append(error(n,row,"Duplicate SKU", "DUPLICATE"))
            seen.add(sku)
        elif import_type == "CUSTOMERS":
            email=row["email"].lower(); phone=row["phone"]
            if not row["name"] or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$",email) or len(phone)<7: problems.append(error(n,row,"Valid name, email, and phone are required")); continue
            duplicate=email in seen or phone in seen_phones or db.query(Customer.id).filter(Customer.company_id==company_id,func.lower(Customer.email)==email).first() or db.query(Customer.id).filter(Customer.company_id==company_id,Customer.phone==phone).first()
            if duplicate: problems.append(error(n,row,"Duplicate email or phone", "DUPLICATE"))
            seen.add(email); seen_phones.add(phone)
        else:
            try:
                qty=int(row["quantity"]); date=datetime.fromisoformat(row["sale_date"].replace("Z","+00:00"))
                if qty<=0 or Decimal(row["unit_price"])<=0: raise ValueError
            except (ValueError,InvalidOperation): problems.append(error(n,row,"Quantity, price, or sale date is invalid")); continue
            product=db.query(Product).filter(Product.company_id==company_id,func.lower(Product.name)==row["product"].lower()).first(); customer=db.query(Customer).filter(Customer.company_id==company_id,func.lower(Customer.full_name)==row["customer"].lower()).first(); invoice=row.get("invoice_number","")
            if not customer: problems.append(error(n,row,"Customer does not exist"))
            elif not product: problems.append(error(n,row,"Product does not exist"))
            elif qty>product.stock_quantity: problems.append(error(n,row,"Quantity exceeds available stock"))
            elif invoice and (invoice in seen or db.query(Sale.id).filter(Sale.company_id==company_id,Sale.invoice_number==invoice).first()): problems.append(error(n,row,"Duplicate invoice number", "DUPLICATE"))
            if invoice: seen.add(invoice)
    return columns,rows,problems

def serialize(job, columns=None, preview=None, problems=None):
    problems = problems if problems is not None else [{"row_number":e.row_number,"row_data":json.loads(e.row_data),"error_type":e.error_type,"message":e.message} for e in job.errors]
    return {"id":job.id,"import_type":job.import_type,"filename":job.filename,"status":job.status,"total_records":job.total_records,"valid_records":job.valid_records,"successful_records":job.successful_records,"failed_records":job.failed_records,"duplicate_records":job.duplicate_records,"columns":columns or parse(job.source_csv)[0],"preview":preview or parse(job.source_csv)[1][:8],"errors":problems,"created_at":job.created_at,"completed_at":job.completed_at,"uploaded_by_name":job.uploader.name if job.uploader else None}

def upload(db, company_id, user_id, import_type, filename, source):
    if len(source.encode())>MAX_BYTES: raise HTTPException(413,"CSV must be 5 MB or smaller")
    typ=import_type.upper(); columns,rows,problems=validate(db,company_id,typ,source)
    job=DataImport(company_id=company_id,uploaded_by=user_id,import_type=typ,filename=filename,source_csv=source,total_records=len(rows),valid_records=len(rows)-len(problems),failed_records=len(problems),duplicate_records=sum(p["error_type"]=="DUPLICATE" for p in problems))
    db.add(job); db.flush()
    for p in problems: db.add(DataImportError(import_id=job.id,row_number=p["row_number"],row_data=json.dumps(p["row_data"]),error_type=p["error_type"],message=p["message"]))
    db.commit(); db.refresh(job); return serialize(job,columns,rows[:8],problems)

def get_job(db, company_id, job_id):
    job=db.query(DataImport).filter(DataImport.id==job_id,DataImport.company_id==company_id).first()
    if not job: raise HTTPException(404,"Import not found")
    return job

def process(db, company_id, job_id):
    job=get_job(db,company_id,job_id)
    if job.status!="PENDING": raise HTTPException(409,"This import has already been processed")
    columns,rows,problems=validate(db,company_id,job.import_type,job.source_csv); rejected={p["row_number"] for p in problems}; job.status="PROCESSING"; db.flush(); done=0
    try:
        for n,row in enumerate(rows,2):
            if n in rejected: continue
            if job.import_type=="PRODUCTS":
                category=db.query(Category).filter(Category.company_id==company_id,func.lower(Category.name)==row["category"].lower()).first()
                if not category: category=Category(company_id=company_id,name=row["category"]); db.add(category); db.flush()
                product=Product(company_id=company_id,category_id=category.id,name=row["product_name"],sku=row["sku"].upper(),unit_price=Decimal(row["unit_price"]),cost_price=Decimal(row.get("cost_price") or row["unit_price"]),stock_quantity=int(row["stock_quantity"]),unit_of_measure=UnitOfMeasure.PCS,status=ProductStatus.ACTIVE); db.add(product); db.flush(); db.add(Inventory(company_id=company_id,product_id=product.id,current_stock=product.stock_quantity,available_stock=product.stock_quantity))
            elif job.import_type=="CUSTOMERS":
                parts=row["name"].split(maxsplit=1); seq=db.query(Customer).filter(Customer.company_id==company_id).count()+1; db.add(Customer(company_id=company_id,customer_id=f"CUST-{datetime.now(timezone.utc).year}-{seq:06d}",full_name=row["name"],first_name=parts[0],last_name=parts[1] if len(parts)>1 else None,email=row["email"],phone=row["phone"],status="ACTIVE"))
            else:
                product=db.query(Product).filter(Product.company_id==company_id,func.lower(Product.name)==row["product"].lower()).first(); customer=db.query(Customer).filter(Customer.company_id==company_id,func.lower(Customer.full_name)==row["customer"].lower()).first(); qty=int(row["quantity"]); price=Decimal(row["unit_price"])
                if qty>product.stock_quantity: raise ValueError("Stock changed during import")
                product.stock_quantity-=qty; inv=db.query(Inventory).filter(Inventory.product_id==product.id).first()
                if inv: inv.current_stock-=qty; inv.available_stock-=qty
                sale=Sale(company_id=company_id,invoice_number=row.get("invoice_number") or f"IMP-{job.id}-{n}",customer_name=customer.full_name,customer_id=customer.id,sale_date=datetime.fromisoformat(row["sale_date"].replace("Z","+00:00")),sales_channel="RETAIL_STORE",payment_method="CASH",payment_status="PAID",subtotal=price*qty,discount_total=0,tax_total=0,total_amount=price*qty,created_by=job.uploaded_by); sale.items=[SaleItem(product_id=product.id,category_id=product.category_id,quantity=qty,unit_price=price,discount=0,tax=0,total=price*qty)]; db.add(sale)
            done+=1
        job.successful_records=done; job.failed_records=job.total_records-done; job.status="COMPLETED" if not job.failed_records else "COMPLETED_WITH_ERRORS"; job.completed_at=datetime.now(timezone.utc); db.commit()
    except Exception:
        db.rollback(); job=get_job(db,company_id,job_id); job.status="FAILED"; job.completed_at=datetime.now(timezone.utc); db.commit(); raise HTTPException(500,"Import failed safely; no records were added")
    return serialize(job,columns,rows[:8],problems)
