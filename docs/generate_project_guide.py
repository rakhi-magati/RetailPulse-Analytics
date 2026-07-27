"""Create the RetailPulse project overview PDF without third-party packages."""
from pathlib import Path

OUT = Path(__file__).with_name("RetailPulse_Project_Guide.pdf")
W, H, M = 595, 842, 48
BLUE = (31, 78, 121)
PURPLE = (79, 70, 229)
TEXT = (31, 41, 55)
MUTED = (75, 85, 99)


def esc(s):
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def wrap(text, width=88):
    words, lines, line = text.split(), [], ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if len(candidate) > width and line:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines or [""]


class Guide:
    def __init__(self):
        self.pages = []
        self.ops = []
        self.y = H - M

    def page(self):
        if self.ops:
            self.pages.append("\n".join(self.ops))
        self.ops, self.y = [], H - M
        self.ops.append("0.97 0.98 1 rg 0 0 595 842 re f")

    def color(self, rgb):
        self.ops.append("%.3f %.3f %.3f rg" % rgb)

    def text(self, x, y, value, size=10, font="F1", color=TEXT):
        self.color(color)
        self.ops.append(f"BT /{font} {size} Tf 1 0 0 1 {x} {y} Tm ({esc(value)}) Tj ET")

    def rule(self, y):
        self.ops.append("0.86 0.88 0.93 RG 0.7 w 48 %.1f m 547 %.1f l S" % (y, y))

    def title(self, value, subtitle=None):
        if self.y < 720:
            self.page()
        self.text(M, self.y, value, 20, "F2", BLUE)
        self.y -= 13
        self.rule(self.y)
        self.y -= 18
        if subtitle:
            self.para(subtitle, 10, MUTED)
            self.y -= 6

    def heading(self, value):
        if self.y < 92:
            self.page()
        self.text(M, self.y, value, 13, "F2", PURPLE)
        self.y -= 18

    def para(self, value, size=9.5, color=TEXT):
        leading = size + 4
        for line in wrap(value, 90):
            if self.y < 62:
                self.page()
            self.text(M, self.y, line, size, "F1", color)
            self.y -= leading

    def bullet(self, label, value):
        if self.y < 70:
            self.page()
        self.text(M, self.y, "-", 10, "F2", PURPLE)
        lines = wrap(value, 82)
        for idx, line in enumerate(lines):
            self.text(M + 14, self.y, line, 9.3, "F2" if idx == 0 else "F1")
            self.y -= 13
        self.y -= 2

    def flow(self, steps):
        for i, step in enumerate(steps):
            if self.y < 72:
                self.page()
            self.ops.append(f"0.93 0.95 1 rg {M} {self.y-5} 499 22 re f")
            self.text(M + 9, self.y + 2, step, 9.5, "F2", TEXT)
            self.y -= 27
            if i != len(steps) - 1:
                self.text(286, self.y + 2, "v", 11, "F2", PURPLE)
                self.y -= 10

    def finish(self):
        self.pages.append("\n".join(self.ops))
        objects = ["<< /Type /Catalog /Pages 2 0 R >>", None, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"]
        page_ids, content_ids = [], []
        next_id = 5
        for page in self.pages:
            page_ids.append(next_id); content_ids.append(next_id + 1); next_id += 2
        objects[1] = "<< /Type /Pages /Kids [" + " ".join(f"{p} 0 R" for p in page_ids) + f"] /Count {len(page_ids)} >>"
        for pid, cid, content in zip(page_ids, content_ids, self.pages):
            objects.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W} {H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents {cid} 0 R >>")
            objects.append(f"<< /Length {len(content.encode('latin-1'))} >>\nstream\n{content}\nendstream")
        pdf = ["%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"]
        offsets = [0]
        pos = len(pdf[0].encode("latin-1"))
        for n, obj in enumerate(objects, 1):
            offsets.append(pos)
            item = f"{n} 0 obj\n{obj}\nendobj\n"
            pdf.append(item); pos += len(item.encode("latin-1"))
        xref = pos
        pdf.append(f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n" + "".join(f"{off:010d} 00000 n \n" for off in offsets[1:]))
        pdf.append(f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n")
        OUT.write_bytes("".join(pdf).encode("latin-1"))


g = Guide(); g.page()
g.text(M, 700, "RetailPulse Analytics", 30, "F2", BLUE)
g.text(M, 665, "Project overview, important topics, and system flows", 16, "F1", MUTED)
g.rule(640)
g.text(M, 595, "Purpose", 13, "F2", PURPLE)
g.para("RetailPulse is a multi-tenant retail management and analytics application. It lets each company manage its catalog, stock, sales, alerts, and analytics while keeping company data isolated.", 11)
g.y -= 20
g.text(M, g.y, "Technology at a glance", 13, "F2", PURPLE); g.y -= 25
g.bullet("", "Frontend: React 19, TypeScript, Vite, Material UI, TanStack Query, Axios, Recharts.")
g.bullet("", "Backend: FastAPI, SQLAlchemy ORM, Pydantic schemas, JWT authentication, and MySQL-compatible configuration.")
g.bullet("", "Cross-cutting concerns: role access control, automatic token refresh, audit logging, inventory movements, and notifications.")
g.y -= 16
g.text(M, g.y, "Reading map", 13, "F2", PURPLE); g.y -= 25
g.para("Start with the architecture and access model, then follow the sales and inventory flows. The analytics section explains how operational data becomes dashboard insights and exports.")

g.page(); g.title("1. System architecture", "Browser client and API server communicate over JSON. The API owns authorization and data access.")
g.flow([
    "React pages and reusable UI components",
    "API client adds JWT access token; interceptor refreshes expired tokens",
    "FastAPI routers validate requests and enforce role dependencies",
    "Services apply business rules, write audit events, and coordinate modules",
    "Repositories / SQLAlchemy models read and write company-scoped database records",
])
g.heading("Frontend responsibilities")
g.bullet("", "Routes: login, registration, dashboard, analytics, categories, products, sales, inventory, and profile.")
g.bullet("", "AuthContext loads /auth/me at startup, exposes the user, login, logout, and refresh-profile actions.")
g.bullet("", "ProtectedRoute redirects unauthenticated visitors to login. RoleGuard hides restricted screens or actions.")
g.bullet("", "TanStack Query fetches and caches server data; the analytics dashboard refreshes itself every 30 seconds.")
g.heading("Backend layering")
g.bullet("", "api/: HTTP endpoints, query parameters, request metadata, and FastAPI dependency injection.")
g.bullet("", "services/: domain behavior such as token rotation, price calculations, stock movements, and report export.")
g.bullet("", "repositories/: filtered database queries and aggregate analytics queries.")
g.bullet("", "models/ and schemas/: persistent table definitions and validated request/response contracts.")

g.page(); g.title("2. Tenant isolation and access control")
g.heading("Tenant boundary")
g.para("Every user belongs to a Company. Protected endpoints derive company_id from the authenticated JWT user rather than trusting a client-provided company ID. Products, categories, sales, inventory, notifications, and audit events are queried within that company scope.")
g.heading("Roles")
g.bullet("", "COMPANY_ADMIN: full operational control. Can manage categories and products, adjust stock, set reorder levels, and view analytics.")
g.bullet("", "ANALYST: can browse products and inventory, create/manage sales, view notifications, and use analytics. Cannot alter catalog or manual stock settings.")
g.bullet("", "SUPER_ADMIN: dependency helper grants this role access to every role-restricted endpoint.")
g.bullet("", "VIEWER exists as a role enum but is not granted access by the current feature routers.")
g.heading("Authentication flow")
g.flow([
    "Company registration creates the Company and its first COMPANY_ADMIN user.",
    "Login validates the password and active status, then issues access and refresh JWTs.",
    "Frontend stores both tokens in localStorage and sends the access token as Bearer authorization.",
    "On a 401, Axios queues requests, calls /auth/refresh once, rotates tokens, and retries queued requests.",
    "Logout revokes the submitted refresh token; password change revokes all refresh tokens for the user.",
])

g.page(); g.title("3. Core data model", "The model is centered on a company-owned retail catalog and the transactions that change stock.")
g.heading("Main relationships")
g.flow([
    "Company -> Users, Categories, Products, Sales, Inventory, Notifications, Audit Logs",
    "Category -> Products (a company cannot repeat a category name)",
    "Product -> one Inventory record and many Sale Items (SKU is unique within a company)",
    "Sale -> many Sale Items (invoice number is unique within a company)",
    "Inventory -> many immutable Inventory Movements",
])
g.heading("Important business fields")
g.bullet("", "Product: category, SKU, brand, selling and cost price, stock_quantity, low_stock_threshold, unit, and active/inactive status.")
g.bullet("", "Inventory: current, reserved, and available stock; reorder level; calculated status: IN_STOCK, LOW_STOCK, or OUT_OF_STOCK.")
g.bullet("", "Sale: invoice, customer, date, channel, payment method, subtotal, discount, tax, total, and individual item lines.")
g.bullet("", "Operational traceability: AuditLog stores who did what, when, where (IP/browser), and optionally the target name. InventoryMovement records every quantity change.")

g.page(); g.title("4. Catalog and inventory flows")
g.heading("Catalog lifecycle")
g.flow([
    "Admin creates a category; duplicate names are rejected within the company.",
    "Admin creates a product with its category, SKU, prices, opening stock, threshold, and status.",
    "Product service keeps a matching inventory record and synchronizes reorder settings.",
    "Direct product stock edits are represented as a manual inventory movement.",
    "Category/product mutations are audit logged; products can be activated or deactivated.",
])
g.heading("Manual stock adjustment")
g.flow([
    "Admin selects stock-in, stock-out, or corrected-count adjustment and supplies a reason.",
    "Service validates that stock cannot become negative and stock-out cannot exceed availability.",
    "Product.stock_quantity and Inventory current/available amounts are kept synchronized.",
    "A movement row, audit event, and possible low/out-of-stock notification are created.",
])
g.heading("Inventory views")
g.para("The inventory page supports filtering by product/SKU, category, brand, and stock status; it also shows summary cards, category/status charts, and movement history. Admins see adjustment and reorder controls; analysts have read access and history access.")

g.page(); g.title("5. Sales to inventory flow", "This is the most important cross-module operational flow.")
g.flow([
    "Admin or Analyst starts a sale and adds one or more product line items.",
    "The service loads each product inside the caller company and combines duplicate requested quantities.",
    "It validates all item availability before applying any deduction, so an unfulfillable multi-item sale fails as a whole.",
    "For each line, total = (unit price x quantity - discount) + tax. Header totals are calculated from the lines.",
    "The service generates a company-scoped invoice such as INV-YYYY-000001 and persists the sale plus SaleItems.",
    "Stock is reduced, a SALE inventory movement and audit log are recorded, and threshold crossings create notifications.",
    "Updating or deleting a sale restores prior stock first, then reapplies the edited sale if appropriate.",
])
g.heading("Sales filters and reporting dimensions")
g.para("Sales can be searched by invoice, customer, or product and filtered by dates, category, channel, and payment method. Supported channels are retail store, online store, and marketplace; payment methods are cash, card, UPI, and bank transfer.")

g.page(); g.title("6. Analytics, notifications, and exports")
g.heading("Analytics dashboard")
g.para("Company Admins and Analysts can apply date, product, category, brand, sales-channel, and payment-method filters. Dates, revenue, and sales trends support daily, weekly, or monthly granularity.")
g.bullet("", "KPIs: total revenue, orders, products sold, average order value, inventory value, low stock count, out of stock count, and category count.")
g.bullet("", "Visuals: revenue/sales trends, top products/categories, payment/channel mix, inventory distribution, stock status, inventory value, and low/out-of-stock lists.")
g.bullet("", "Drill-downs: clicking KPIs returns underlying sales/inventory records; categories drill to products; products drill to transactions.")
g.bullet("", "Exports: /analytics/export produces CSV or PDF from the currently selected filters and granularity.")
g.heading("Notifications and audit")
g.para("Inventory threshold transitions produce LOW_STOCK or OUT_OF_STOCK notifications. Users can fetch notifications and mark them read. Authentication, catalog, sale, stock, dashboard filter/view, and report-export actions are written to the audit log.")
g.heading("API modules")
g.para("/auth, /users, /categories, /products, /sales, /inventory, /notifications, and /analytics are registered in FastAPI main.py. The health endpoint is /health.")

g.page(); g.title("7. Project navigation and operating notes")
g.heading("Where to look in the repository")
g.bullet("", "frontend/src/App.tsx: route map. api/client.ts: token injection and refresh. context/AuthContext.tsx: session state.")
g.bullet("", "frontend/src/pages/: feature screens. AnalyticsDashboardPage uses charts, filters, drill-downs, refresh, and exports.")
g.bullet("", "backend/app/main.py: application startup, middleware, models, and router registration.")
g.bullet("", "backend/app/api/: endpoint boundaries. services/: business logic. repositories/: queries. models/: database relationships.")
g.heading("Configuration and production considerations")
g.bullet("", "Backend reads DATABASE_URL, SECRET_KEY, token lifetimes, and FRONTEND_ORIGIN from environment variables. The code has development defaults; production should provide secure values.")
g.bullet("", "The backend calls Base.metadata.create_all at startup. The source notes that Alembic migrations should be used for production schema changes.")
g.bullet("", "CORS currently permits the configured frontend origin with credentials. Keep the origin explicit in deployed environments.")
g.heading("End-to-end summary")
g.para("RetailPulse begins with company onboarding and JWT-secured access. Admins establish categories and products; analysts and admins capture sales. Each sale updates stock, records movement/audit evidence, and may create a stock alert. Analytics then aggregates the same company-scoped sales and inventory data into actionable KPIs, drill-downs, and exports.")
g.finish()
print(OUT)
