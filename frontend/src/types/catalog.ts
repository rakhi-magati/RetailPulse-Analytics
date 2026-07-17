export type CategoryStatus = "ACTIVE" | "INACTIVE";
export type ProductStatus = "ACTIVE" | "INACTIVE";

export type UnitOfMeasure =
  | "PCS"
  | "KG"
  | "GRAM"
  | "LITRE"
  | "ML"
  | "BOX"
  | "PACK"
  | "DOZEN"
  | "METER"
  | "UNIT";

export interface Category {
  id: number;
  company_id: number;
  name: string;
  description: string | null;
  status: CategoryStatus;
  created_at: string;
  updated_at: string | null;
  product_count: number;
}

export interface CategoryBrief {
  id: number;
  name: string;
  status: CategoryStatus;
}

export interface CategoryCreateRequest {
  name: string;
  description?: string | null;
  status?: CategoryStatus;
}

export type CategoryUpdateRequest = Partial<CategoryCreateRequest>;

export interface Product {
  id: number;
  company_id: number;
  category_id: number;
  name: string;
  sku: string;
  brand: string | null;
  description: string | null;
  unit_price: number;
  cost_price: number;
  stock_quantity: number;
  unit_of_measure: UnitOfMeasure;
  status: ProductStatus;
  created_at: string;
  updated_at: string | null;
  category: CategoryBrief | null;
}

export interface ProductCreateRequest {
  name: string;
  sku: string;
  category_id: number;
  brand?: string | null;
  description?: string | null;
  unit_price: number;
  cost_price: number;
  stock_quantity: number;
  unit_of_measure: UnitOfMeasure;
  status?: ProductStatus;
}

export type ProductUpdateRequest = Partial<ProductCreateRequest>;

export interface ProductFilters {
  search?: string;
  category_id?: number;
  status?: ProductStatus;
  brand?: string;
  sort_by?: "name" | "price" | "recent";
}

export interface DashboardSummary {
  total_products: number;
  active_products: number;
  inactive_products: number;
  total_categories: number;
}
