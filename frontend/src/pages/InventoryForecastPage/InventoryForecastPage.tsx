import { useState } from "react";
import {
  Alert,
  Box,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { inventoryApi } from "../../api/inventory";
import { categoriesApi, productsApi } from "../../api/catalog";
import type {
  InventoryForecastItem,
  StockRisk,
} from "../../types/inventory";
import RoleGuard from "../../components/RoleGuard";
import "./InventoryForecastPage.css";

const riskColor: Record<
  StockRisk,
  "error" | "warning" | "success" | "info"
> = {
  OUT_OF_STOCK: "error",
  STOCKOUT_RISK: "error",
  LOW_STOCK: "warning",
  HEALTHY: "success",
  OVERSTOCK: "info",
};

const riskLabel: Record<StockRisk, string> = {
  OUT_OF_STOCK: "Out of stock",
  STOCKOUT_RISK: "Stockout risk",
  LOW_STOCK: "Low stock",
  HEALTHY: "Healthy",
  OVERSTOCK: "Overstock",
};

export default function InventoryForecastPage() {
  const [forecastDays, setForecastDays] = useState(30);
  const [risk, setRisk] = useState<StockRisk | "ALL">("ALL");
  const [reorderOnly, setReorderOnly] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [productId, setProductId] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);

  // Categories
  const categories = useQuery({
    queryKey: ["forecast-categories"],
    queryFn: () => categoriesApi.list(),
    staleTime: 600_000,
  });

  // Products
  const products = useQuery({
    queryKey: ["forecast-products"],
    queryFn: () => productsApi.list(),
    staleTime: 600_000,
  });

  // Forecast
  const query = useQuery({
    queryKey: [
      "inventory-forecast",
      forecastDays,
      risk,
      reorderOnly,
      categoryId,
      productId,
    ],

    queryFn: () =>
      inventoryApi.forecast({
        forecast_days: forecastDays,

        category_id:
          categoryId === "all" ? undefined : Number(categoryId),

        product_id:
          productId === "all" ? undefined : Number(productId),

        stock_risk:
          risk === "ALL" ? undefined : risk,

        reorder_required:
          reorderOnly === "all"
            ? undefined
            : reorderOnly === "yes",
      }),

    staleTime: 60_000,
  });

  // Selected product recommendation
  const detail = useQuery({
    queryKey: [
      "inventory-recommendation",
      selectedProduct,
      forecastDays,
    ],

    queryFn: () =>
      inventoryApi.recommendation(
        selectedProduct!,
        forecastDays
      ),

    enabled: selectedProduct !== null,

    staleTime: 60_000,
  });

  const items = query.data?.items ?? [];
  const selected = detail.data;

  const stat = (
    label: string,
    value: number,
    color: string
  ) => (
    <Grid size={{ xs: 6, md: 3 }}>
      <Paper className="replenishment-stat">
        <Typography
          color="text.secondary"
          variant="body2"
        >
          {label}
        </Typography>

        <Typography
          variant="h4"
          sx={{
            color,
            fontWeight: 750,
          }}
        >
          {value}
        </Typography>
      </Paper>
    </Grid>
  );

  return (
    <RoleGuard allowedRoles={["COMPANY_ADMIN", "ANALYST"]}>
      <Box className="replenishment-page">

        {/* Header */}
        <Box className="replenishment-heading">
          <Box>
            <Typography
              variant="h4"
              fontWeight={750}
            >
              Smart Replenishment
            </Typography>

            <Typography color="text.secondary">
              {forecastDays}-day moving-average demand,
              lead time, and safety-stock recommendations.
            </Typography>
          </Box>
        </Box>

        {/* Filters */}
        <Paper className="replenishment-filters">

          <FormControl size="small">
            <InputLabel>Forecast horizon</InputLabel>

            <Select
              label="Forecast horizon"
              value={forecastDays}
              onChange={(e) =>
                setForecastDays(Number(e.target.value))
              }
            >
              <MenuItem value={7}>
                Next 7 days
              </MenuItem>

              <MenuItem value={30}>
                Next 30 days
              </MenuItem>

              <MenuItem value={90}>
                Next 90 days
              </MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small">
            <InputLabel>Stock risk</InputLabel>

            <Select
              label="Stock risk"
              value={risk}
              onChange={(e) =>
                setRisk(
                  e.target.value as StockRisk | "ALL"
                )
              }
            >
              <MenuItem value="ALL">
                All risks
              </MenuItem>

              {Object.entries(riskLabel).map(
                ([value, label]) => (
                  <MenuItem
                    key={value}
                    value={value}
                  >
                    {label}
                  </MenuItem>
                )
              )}
            </Select>
          </FormControl>

          <FormControl size="small">
            <InputLabel>Category</InputLabel>

            <Select
              label="Category"
              value={categoryId}
              onChange={(e) =>
                setCategoryId(e.target.value)
              }
            >
              <MenuItem value="all">
                All categories
              </MenuItem>

              {(categories.data ?? []).map(
                (category) => (
                  <MenuItem
                    key={category.id}
                    value={String(category.id)}
                  >
                    {category.name}
                  </MenuItem>
                )
              )}
            </Select>
          </FormControl>

          <FormControl size="small">
            <InputLabel>Product</InputLabel>

            <Select
              label="Product"
              value={productId}
              onChange={(e) => {
                const value = e.target.value;

                setProductId(value);

                setSelectedProduct(
                  value === "all"
                    ? null
                    : Number(value)
                );
              }}
            >
              <MenuItem value="all">
                All products
              </MenuItem>

              {(products.data ?? []).map(
                (product) => (
                  <MenuItem
                    key={product.id}
                    value={String(product.id)}
                  >
                    {product.name}
                  </MenuItem>
                )
              )}
            </Select>
          </FormControl>

          <FormControl size="small">
            <InputLabel>Reorder</InputLabel>

            <Select
              label="Reorder"
              value={reorderOnly}
              onChange={(e) =>
                setReorderOnly(e.target.value)
              }
            >
              <MenuItem value="all">
                All products
              </MenuItem>

              <MenuItem value="yes">
                Reorder required
              </MenuItem>

              <MenuItem value="no">
                No reorder needed
              </MenuItem>
            </Select>
          </FormControl>

        </Paper>

        {/* Forecast Error */}
        {query.isError && (
          <Alert severity="error">
            Could not load inventory recommendations.
            Please try again.
          </Alert>
        )}

        {/* Loading */}
        {query.isLoading && (
          <>
            <Skeleton
              variant="rounded"
              height={100}
              sx={{ mb: 2 }}
            />

            <Skeleton
              variant="rounded"
              height={350}
            />
          </>
        )}

        {/* Data */}
        {!query.isLoading && query.data && (
          <>
            {/* Summary */}
            <Grid
              container
              spacing={2}
              sx={{ mb: 3 }}
            >
              {stat(
                "Reorder required",
                query.data.summary
                  .products_requiring_reorder,
                "#d97706"
              )}

              {stat(
                "Stockout risk",
                query.data.summary
                  .products_at_stockout_risk,
                "#dc2626"
              )}

              {stat(
                "Overstocked",
                query.data.summary
                  .overstocked_products,
                "#2563eb"
              )}

              {stat(
                "Healthy",
                query.data.summary
                  .healthy_products,
                "#059669"
              )}
            </Grid>

            {/* Chart + Recommendation */}
            <Grid
              container
              spacing={3}
            >

              {/* Chart */}
              <Grid size={{ xs: 12, lg: 7 }}>
                <Paper className="replenishment-card">

                  <Typography variant="h6">
                    Stock vs forecast demand
                  </Typography>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    Select a row below to inspect
                    its replenishment plan.
                  </Typography>

                  {items.length === 0 ? (
                    <Box className="replenishment-empty">
                      No forecast data available.
                    </Box>
                  ) : (
                    <ResponsiveContainer
                      width="100%"
                      height={280}
                    >
                      <BarChart
                        data={items.slice(0, 10)}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                        />

                        <XAxis
                          dataKey="product_name"
                          hide
                        />

                        <YAxis
                          allowDecimals={false}
                        />

                        <Tooltip />

                        <Legend />

                        <Bar
                          dataKey="current_stock"
                          name="Current stock"
                          fill="#4f46e5"
                        />

                        <Bar
                          dataKey="forecasted_demand"
                          name="Forecast demand"
                          fill="#f59e0b"
                        />

                        <Bar
                          dataKey="reorder_point"
                          name="Reorder point"
                          fill="#10b981"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}

                </Paper>
              </Grid>

              {/* Recommendation */}
              <Grid size={{ xs: 12, lg: 5 }}>
                <Paper className="replenishment-card">

                  <Typography variant="h6">
                    Recommendation comparison
                  </Typography>

                  {detail.isLoading && (
                    <Skeleton height={230} />
                  )}

                  {detail.isError && (
                    <Alert
                      severity="error"
                      sx={{ mt: 2 }}
                    >
                      Could not load product
                      recommendation.
                    </Alert>
                  )}

                  {!detail.isLoading &&
                    !detail.isError &&
                    selected && (
                      <>
                        <Typography
                          sx={{
                            mt: 1,
                            fontWeight: 700,
                          }}
                        >
                          {selected.product_name} ·{" "}
                          {selected.sku}
                        </Typography>

                        <Alert
                          severity={
                            selected.reorder_required
                              ? "warning"
                              : "success"
                          }
                          sx={{ my: 1.5 }}
                        >
                          {selected.recommendation}
                        </Alert>

                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>
                                Metric
                              </TableCell>

                              <TableCell align="right">
                                Current
                              </TableCell>

                              <TableCell align="right">
                                Recommended
                              </TableCell>
                            </TableRow>
                          </TableHead>

                          <TableBody>

                            <TableRow>
                              <TableCell>
                                Stock
                              </TableCell>

                              <TableCell align="right">
                                {selected.current_stock}
                              </TableCell>

                              <TableCell align="right">
                                <b>
                                  {selected.current_stock +
                                    selected.recommended_reorder_quantity}
                                </b>
                              </TableCell>
                            </TableRow>

                            <TableRow>
                              <TableCell>
                                Daily demand
                              </TableCell>

                              <TableCell align="right">
                                {selected.average_daily_sales}
                              </TableCell>

                              <TableCell align="right">
                                {selected.average_daily_sales}
                              </TableCell>
                            </TableRow>

                            <TableRow>
                              <TableCell>
                                Reorder point
                              </TableCell>

                              <TableCell align="right">
                                {selected.reorder_point}
                              </TableCell>

                              <TableCell align="right">
                                {selected.reorder_point}
                              </TableCell>
                            </TableRow>

                            <TableRow>
                              <TableCell>
                                Safety stock
                              </TableCell>

                              <TableCell align="right">
                                {selected.safety_stock}
                              </TableCell>

                              <TableCell align="right">
                                {selected.safety_stock}
                              </TableCell>
                            </TableRow>

                          </TableBody>
                        </Table>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 1 }}
                        >
                          Recommended order:{" "}
                          <b>
                            {
                              selected.recommended_reorder_quantity
                            }{" "}
                            units
                          </b>
                        </Typography>
                      </>
                    )}

                  {!detail.isLoading &&
                    !detail.isError &&
                    !selected && (
                      <Box className="replenishment-empty">
                        Choose a product to compare
                        current and recommended
                        inventory.
                      </Box>
                    )}

                </Paper>
              </Grid>
            </Grid>

            {/* Product Table */}
            <Paper className="replenishment-card">

              <Typography variant="h6">
                Product recommendations
              </Typography>

              {items.length === 0 ? (
                <Box className="replenishment-empty">
                  No products match these filters.
                </Box>
              ) : (
                <TableContainer>

                  <Table size="small">

                    <TableHead>
                      <TableRow>
                        <TableCell>
                          Product
                        </TableCell>

                        <TableCell align="right">
                          Current
                        </TableCell>

                        <TableCell align="right">
                          Daily sales
                        </TableCell>

                        <TableCell align="right">
                          Forecast
                        </TableCell>

                        <TableCell align="right">
                          Days left
                        </TableCell>

                        <TableCell align="right">
                          Reorder point
                        </TableCell>

                        <TableCell align="right">
                          Recommended order
                        </TableCell>

                        <TableCell>
                          Risk
                        </TableCell>

                        <TableCell>
                          Recommendation
                        </TableCell>
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {items.map(
                        (item: InventoryForecastItem) => (
                          <TableRow
                            hover
                            selected={
                              selectedProduct ===
                              item.product_id
                            }
                            onClick={() =>
                              setSelectedProduct(
                                item.product_id
                              )
                            }
                            sx={{
                              cursor: "pointer",
                            }}
                            key={item.product_id}
                          >

                            <TableCell>
                              <b>
                                {item.product_name}
                              </b>

                              <Typography
                                variant="caption"
                                display="block"
                              >
                                {item.sku} ·{" "}
                                {item.category_name}
                              </Typography>
                            </TableCell>

                            <TableCell align="right">
                              {item.current_stock}
                            </TableCell>

                            <TableCell align="right">
                              {
                                item.average_daily_sales
                              }
                            </TableCell>

                            <TableCell align="right">
                              {item.forecasted_demand}
                            </TableCell>

                            <TableCell align="right">
                              {item.days_of_stock_remaining ??
                                "No demand"}
                            </TableCell>

                            <TableCell align="right">
                              {item.reorder_point}
                            </TableCell>

                            <TableCell align="right">
                              <b>
                                {
                                  item.recommended_reorder_quantity
                                }
                              </b>
                            </TableCell>

                            <TableCell>
                              <Chip
                                size="small"
                                color={
                                  riskColor[
                                  item.stock_risk
                                  ]
                                }
                                label={
                                  riskLabel[
                                  item.stock_risk
                                  ]
                                }
                              />
                            </TableCell>

                            <TableCell>
                              {item.recommendation}
                            </TableCell>

                          </TableRow>
                        )
                      )}
                    </TableBody>

                  </Table>

                </TableContainer>
              )}

            </Paper>
          </>
        )}
      </Box>
    </RoleGuard>
  );
}