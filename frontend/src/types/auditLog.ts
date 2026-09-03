export interface AuditLog {
  id: number;

  user_id: number;

  user_name: string;

  user_email: string;

  action: string;

  resource_type: string | null;

  resource_id: string | null;

  description: string | null;

  entity_name: string | null;

  ip_address: string | null;

  user_agent: string | null;

  status: string;

  created_at: string;
}


// ==============================
// Audit Log Detail
// ==============================

export interface AuditLogDetail
  extends AuditLog {

  before_values:
    | Record<string, unknown>
    | null;

  after_values:
    | Record<string, unknown>
    | null;
}


// ==============================
// Audit Log Pagination Response
// ==============================
export interface AuditLogPage {
  items: AuditLog[];

  total: number;

  page: number;

  limit: number;

  total_pages: number;
}


// =================
// Audit Log Filters
// ==================
export interface AuditLogFilters {
  page: number;

  limit: number;

  search?: string;

  user_id?: number;

  action?: string;

  resource_type?: string;

  status?: string;

  start_date?: string;

  end_date?: string;

  sort:
    | "newest"
    | "oldest";
}