import type { PaymentMethod, SalesChannel } from "./sales";
import type { StockStatus } from "./inventory";

export type Granularity = "daily" | "weekly" | "monthly";
export type DateRangePreset = "today" | "last_7_days" | "last_30_days" | "this_month" | "last_month" | "custom";

export interface AnalyticsFilters {
  date_from?: string;
  date_to?: string;
  product_id?: number;
  category_id?: number;
  brand?: string;
  sales_channel?: SalesChannel;
  payment_method?: PaymentMethod;
  customer_id?: number;
  customer_name?: string;
}

export interface AnalyticsKPIs {
  total_revenue: number;
  total_orders: number;
  total_products_sold: number;
  average_order_value: number;
  total_inventory_value: number;
  low_stock_products: number;
  out_of_stock_products: number;
  total_categories: number;
  total_discount?: number;
  total_tax?: number;
}

export interface SalesSummaryKPIs {
  total_revenue: number;
  total_orders: number;
  average_order_value: number;
  total_products_sold: number;
  total_discount: number;
  total_tax: number;
}

export interface RevenueTrendPoint {
  period: string;
  revenue: number;
  orders: number;
}

export interface SalesTrendPoint {
  period: string;
  quantity_sold: number;
  orders: number;
}

export interface TopProductItem {
  product_id: number;
  product_name: string;
  sku: string;
  category_name: string | null;
  quantity_sold: number;
  revenue: number;
}

export interface TopCategoryItem {
  category_id: number | null;
  category_name: string;
  quantity_sold: number;
  revenue: number;
}

export interface TopCustomerItem {
  customer_name: string;
  orders: number;
  total_spend: number;
  average_order_value: number;
}

export interface PaymentMethodBreakdownItem {
  payment_method: PaymentMethod;
  revenue: number;
  orders: number;
}

export interface ChannelBreakdownItem {
  sales_channel: SalesChannel;
  revenue: number;
  orders: number;
}

export interface InventoryDistributionItem {
  category_id: number | null;
  category_name: string;
  total_quantity: number;
  product_count: number;
}

export interface StockStatusSummaryItem {
  stock_status: StockStatus;
  count: number;
}

export interface LowStockItem {
  product_id: number;
  product_name: string;
  sku: string;
  category_name: string | null;
  available_stock: number;
  reorder_level: number;
}

export interface OutOfStockItem {
  product_id: number;
  product_name: string;
  sku: string;
  category_name: string | null;
}

export interface InventoryValueByCategoryItem {
  category_id: number | null;
  category_name: string;
  inventory_value: number;
}

export interface AnalyticsDashboard {
  kpis: AnalyticsKPIs;
  revenue_trend: RevenueTrendPoint[];
  sales_trend: SalesTrendPoint[];
  top_products: TopProductItem[];
  top_categories: TopCategoryItem[];
  top_customers?: TopCustomerItem[];
  by_payment_method: PaymentMethodBreakdownItem[];
  by_channel: ChannelBreakdownItem[];
  inventory_distribution: InventoryDistributionItem[];
  stock_status_summary: StockStatusSummaryItem[];
  low_stock_products: LowStockItem[];
  out_of_stock_products: OutOfStockItem[];
  inventory_value_by_category: InventoryValueByCategoryItem[];
}

export type KPIKey =
  | "revenue"
  | "orders"
  | "products_sold"
  | "average_order_value"
  | "inventory_value"
  | "low_stock_products"
  | "out_of_stock_products"
  | "total_categories";
