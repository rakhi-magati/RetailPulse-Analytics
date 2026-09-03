import { apiClient } from "./client";
import type { AuditLogDetail, AuditLogFilters, AuditLogPage } from "../types/auditLog";
export const auditLogsApi = {
  list: (params: AuditLogFilters) => apiClient.get<AuditLogPage>("/audit-logs", { params }).then(r => r.data),
  get: (id: number) => apiClient.get<AuditLogDetail>(`/audit-logs/by-id/${id}`).then(r => r.data),
  export: (format: "csv" | "pdf", params: Omit<AuditLogFilters, "page" | "limit" | "sort">) => apiClient.get(`/audit-logs/export/${format}`,
     { params, responseType: "blob" }).then(r => r.data),
};
