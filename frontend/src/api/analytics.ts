import { apiClient } from "./client";
import type {
  AnalyticsDashboard,
  AnalyticsFilters,
  Granularity,
  KPIKey,
} from "../types/analytics";

function buildParams(filters: AnalyticsFilters, extra: Record<string, unknown> = {}) {
  // Date inputs are calendar dates; include the whole selected end date.
  const dateTo = filters.date_to && !filters.date_to.includes("T")
    ? `${filters.date_to}T23:59:59.999`
    : filters.date_to;
  return { ...filters, date_to: dateTo, ...extra };
}

export const analyticsApi = {
  dashboard: (filters: AnalyticsFilters, granularity: Granularity) =>
    apiClient
      .get<AnalyticsDashboard>("/analytics/dashboard", {
        params: buildParams(filters, { granularity }),
      })
      .then((res) => res.data),

  drillDownKpi: (kpiKey: KPIKey, filters: AnalyticsFilters) =>
    apiClient
      .get<Record<string, unknown>[]>(`/analytics/drill-down/kpi/${kpiKey}`, { params: buildParams(filters) })
      .then((res) => res.data),

  drillDownCategory: (categoryId: number, filters: AnalyticsFilters) =>
    apiClient
      .get<Record<string, unknown>[]>(`/analytics/drill-down/category/${categoryId}`, { params: buildParams(filters) })
      .then((res) => res.data),

  drillDownProduct: (productId: number, filters: AnalyticsFilters) =>
    apiClient
      .get<Record<string, unknown>[]>(`/analytics/drill-down/product/${productId}`, { params: buildParams(filters) })
      .then((res) => res.data),

  export: (
    format: "csv" | "pdf",
    filters: AnalyticsFilters,
    granularity: Granularity
  ) =>
    apiClient
      .get(`/analytics/export`, {
        params: buildParams(filters, { granularity, format }),
        responseType: "blob",
      })
      .then((res) => res.data as Blob),
};
