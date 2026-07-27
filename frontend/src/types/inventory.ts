import type { CategoryBrief, UnitOfMeasure } from "./catalog";

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export type AdjustmentType = "STOCK_IN" | "STOCK_OUT" | "MANUAL_ADJUSTMENT";

export type MovementType =
  | "SALE"
  | "MANUAL_ADJUSTMENT"
  | "STOCK_ADDITION"
  | "STOCK_REMOVAL";

export interface ProductBrief {
  id: number;
  name: string;
  sku: string;
  brand: string | null;
  unit_of_measure: UnitOfMeasure;
}

export interface InventoryItem {
  id: number;
  company_id: number;
  product_id: number;
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
  reorder_level: number;
  stock_status: StockStatus;
  updated_at: string | null;
  product: ProductBrief | null;
  category: CategoryBrief | null;
}

export interface InventoryFilters {
  search?: string;
  category_id?: number;
  stock_status?: StockStatus;
  brand?: string;
  sort_by?: "name" | "stock" | "updated";
}

export interface StockAdjustmentRequest {
  adjustment_type: AdjustmentType;
  quantity: number;
  reason: string;
  remarks?: string | null;
}

export interface ReorderLevelRequest {
  reorder_level: number;
}

export interface InventoryMovement {
  id: number;
  inventory_id: number;
  product_id: number;
  product_name: string | null;
  sku: string | null;
  movement_type: MovementType;
  quantity_changed: number;
  previous_quantity: number;
  updated_quantity: number;
  reason: string | null;
  remarks: string | null;
  performed_by: number;
  performed_by_name: string | null;
  created_at: string;
}

export interface InventoryDashboardSummary {
  total_products: number;
  total_inventory_quantity: number;
  low_stock_products: number;
  out_of_stock_products: number;
}

export interface CategoryBreakdownItem {
  category_id: number | null;
  category_name: string;
  total_quantity: number;
}

export interface StockStatusBreakdownItem {
  stock_status: StockStatus;
  count: number;
}

export interface InventoryCharts {
  by_category: CategoryBreakdownItem[];
  by_stock_status: StockStatusBreakdownItem[];
}
