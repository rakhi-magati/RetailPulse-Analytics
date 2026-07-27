import { apiClient } from "./client";
import type {
  InventoryCharts,
  InventoryDashboardSummary,
  InventoryFilters,
  InventoryItem,
  InventoryMovement,
  ReorderLevelRequest,
  StockAdjustmentRequest,
} from "../types/inventory";

export const inventoryApi = {
  list: (filters: InventoryFilters = {}) =>
    apiClient
      .get<InventoryItem[]>("/inventory", { params: filters })
      .then((res) => res.data),

  get: (productId: number) =>
    apiClient
      .get<InventoryItem>(`/inventory/product/${productId}`)
      .then((res) => res.data),

  dashboardSummary: () =>
    apiClient
      .get<InventoryDashboardSummary>("/inventory/dashboard-summary")
      .then((res) => res.data),

  charts: () =>
    apiClient.get<InventoryCharts>("/inventory/charts").then((res) => res.data),

  movements: (productId?: number) =>
    apiClient
      .get<InventoryMovement[]>("/inventory/movements", {
        params: productId ? { product_id: productId } : {},
      })
      .then((res) => res.data),

  productMovements: (productId: number) =>
    apiClient
      .get<InventoryMovement[]>(`/inventory/product/${productId}/movements`)
      .then((res) => res.data),

  adjustStock: (productId: number, payload: StockAdjustmentRequest) =>
    apiClient
      .post<InventoryItem>(`/inventory/product/${productId}/adjust`, payload)
      .then((res) => res.data),

  updateReorderLevel: (productId: number, payload: ReorderLevelRequest) =>
    apiClient
      .patch<InventoryItem>(`/inventory/product/${productId}/reorder-level`, payload)
      .then((res) => res.data),
};
