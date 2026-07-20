export type SalesChannel = "RETAIL_STORE" | "ONLINE_STORE" | "MARKETPLACE";
export type PaymentMethod = "CASH" | "CARD" | "UPI" | "BANK_TRANSFER";

export interface SaleItemInput {
  product_id: number;
  quantity: number;
  unit_price: number;
  discount: number;
  tax: number;
}

export interface SaleItem {
  id: number;
  product_id: number;
  product_name: string | null;
  sku: string | null;
  category_id: number;
  category_name: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  tax: number;
  total: number;
}

export interface Sale {
  id: number;
  company_id: number;
  invoice_number: string;
  customer_name: string;
  sale_date: string;
  sales_channel: SalesChannel;
  payment_method: PaymentMethod;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total_amount: number;
  created_by: number;
  created_by_name: string | null;
  created_at: string;
  updated_at: string | null;
  items: SaleItem[];
}

export interface SaleListItem {
  id: number;
  invoice_number: string;
  customer_name: string;
  sale_date: string;
  sales_channel: SalesChannel;
  payment_method: PaymentMethod;
  total_amount: number;
  item_count: number;
  product_summary: string | null;
}

export interface SaleCreateRequest {
  customer_name: string;
  sale_date?: string | null;
  sales_channel: SalesChannel;
  payment_method: PaymentMethod;
  items: SaleItemInput[];
}

export type SaleUpdateRequest = Partial<SaleCreateRequest>;

export interface SaleFilters {
  search?: string;
  date_from?: string;
  date_to?: string;
  category_id?: number;
  sales_channel?: SalesChannel;
  payment_method?: PaymentMethod;
  sort_by?: "date" | "invoice_number" | "total_amount";
  sort_dir?: "asc" | "desc";
}

export interface SalesDashboardSummary {
  total_sales: number;
  total_revenue: number;
  total_orders: number;
  average_order_value: number;
}
