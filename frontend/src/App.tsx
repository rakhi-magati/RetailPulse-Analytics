import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import RegisterPage from "./pages/RegisterPage/RegisterPage";
import ProfilePage from "./pages/ProfilePage/ProfilePage";
import NotFoundPage from "./pages/NotFoundPage/NotFoundPage";
import DashboardPage from "./pages/Dashboardpage/DashboardPage";
import LoginPage from "./pages/LoginPage/LoginPage";
import CategoriesPage from "./pages/CategoriesPage/CategoriesPage";
import ProductsPage from "./pages/ProductsPage/ProductsPage";
import SalesPage from "./pages/SalesPage/SalesPage";
import AnalyticsDashboardPage from "./pages/AnalyticsDashboardPage/AnalyticsDashboardPage";
import SalesAnalyticsPage from "./pages/SalesAnalyticsPage/SalesAnalyticsPage";
import InventoryPage from "./pages/InventoryPage/InventoryPage";
import InventoryForecastPage from "./pages/InventoryForecastPage/InventoryForecastPage";
import CustomersPage from "./pages/CustomersPage/CustomersPage";
import ForecastPage from "./pages/ForecastPage/ForecastPage";
import DataImportPage from "./pages/DataImportPage/DataImportPage";
import AuditLogsPage from "./pages/AuditLogsPage/AuditLogsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/analytics" element={<SalesAnalyticsPage />} />
          <Route path="/analyticsales" element={<SalesAnalyticsPage />} />
          <Route path="/analytics/general" element={<AnalyticsDashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/inventory/forecast" element={<InventoryForecastPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/forecasts" element={<ForecastPage />} />
          <Route path="/data-import" element={<DataImportPage />} />
          <Route path="/audit-logs" element={<AuditLogsPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
