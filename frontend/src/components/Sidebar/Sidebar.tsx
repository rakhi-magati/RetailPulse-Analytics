import { useState } from "react";

import {
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from "@mui/material";

import { useLocation, useNavigate } from "react-router-dom";

import DashboardIcon from "@mui/icons-material/DashboardOutlined";
import AnalyticsIcon from "@mui/icons-material/BarChartOutlined";
import ForecastIcon from "@mui/icons-material/AutoGraphOutlined";
import SalesIcon from "@mui/icons-material/StorefrontOutlined";
import ProductsIcon from "@mui/icons-material/Inventory2Outlined";
import CategoriesIcon from "@mui/icons-material/CategoryOutlined";
import CustomersIcon from "@mui/icons-material/GroupOutlined";
import InventoryIcon from "@mui/icons-material/WarehouseOutlined";
import ReportsIcon from "@mui/icons-material/DescriptionOutlined";
import AlertsIcon from "@mui/icons-material/NotificationsNoneOutlined";
import UsersIcon from "@mui/icons-material/BadgeOutlined";
import SettingsIcon from "@mui/icons-material/SettingsOutlined";
import AuditLogsIcon from "@mui/icons-material/HistoryOutlined";
import ImportExportIcon from "@mui/icons-material/ImportExportOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";

import { useThemeMode } from "../../context/ThemeModeContext";
import { useAuth } from "../../context/AuthContext";

import "./Sidebar.css";


// --------------------------------------------------
// Navigation Item Interface
// --------------------------------------------------

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  adminOnly?: boolean;
}


// --------------------------------------------------
// Sidebar Navigation Items
// --------------------------------------------------

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    icon: <DashboardIcon />,
    path: "/dashboard",
  },
  {
    label: "Sales Analytics",
    icon: <AnalyticsIcon />,
    path: "/analyticsales",
  },
  {
    label: "Demand Forecasting",
    icon: <ForecastIcon />,
    path: "/forecasts",
  },
  {
    label: "Smart Replenishment",
    icon: <InventoryIcon />,
    path: "/inventory/forecast",
  },
  {
    label: "Sales",
    icon: <SalesIcon />,
    path: "/sales",
  },
  {
    label: "Products",
    icon: <ProductsIcon />,
    path: "/products",
  },
  {
    label: "Categories",
    icon: <CategoriesIcon />,
    path: "/categories",
  },
  {
    label: "Customers",
    icon: <CustomersIcon />,
    path: "/customers",
  },
  {
    label: "Inventory",
    icon: <InventoryIcon />,
    path: "/inventory",
  },
  {
    label: "Data Import",
    icon: <ImportExportIcon />,
    path: "/data-import",
    adminOnly: true,
  },
  {
    label: "Audit Logs",
    icon: <AuditLogsIcon />,
    path: "/audit-logs",
    adminOnly: true,
  },
  {
    label: "Reports",
    icon: <ReportsIcon />,
    path: "/dashboard",
  },
  {
    label: "Alerts",
    icon: <AlertsIcon />,
    path: "/dashboard",
  },
  {
    label: "Users",
    icon: <UsersIcon />,
    path: "/dashboard",
    adminOnly: true,
  },
  {
    label: "Settings",
    icon: <SettingsIcon />,
    path: "/profile",
  },
];


// --------------------------------------------------
// Sidebar Component
// --------------------------------------------------

export default function Sidebar() {
  // React Router hooks
  const navigate = useNavigate();
  const location = useLocation();

  // Theme context
  const { mode, setMode } = useThemeMode();

  // Authentication context
  const { user } = useAuth();

  // Sidebar collapsed state
  const [collapsed, setCollapsed] = useState(false);


  // --------------------------------------------------
  // Check whether current user is an admin
  // --------------------------------------------------

  const isAdmin =
    user?.role === "COMPANY_ADMIN" ||
    user?.role === "SUPER_ADMIN";



  // --------------------------------------------------
  // JSX
  // --------------------------------------------------

  return (
    <Box
      className={`sidebar ${
        collapsed ? "sidebar-collapsed" : ""
      }`}
    >

      {/* --------------------------------------------- */}
      {/* Sidebar Logo */}
      {/* --------------------------------------------- */}

      <Box className="sidebar-logo">
        <Tooltip
          title={
            collapsed
              ? "Expand menu"
              : "Collapse menu"
          }
          placement="right"
        >
          <Box
            className="sidebar-logo-button"
            onClick={() =>
              setCollapsed((value) => !value)
            }
            role="button"
            tabIndex={0}
            aria-label={
              collapsed
                ? "Expand navigation"
                : "Collapse navigation"
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setCollapsed((value) => !value);
              }
            }}
          >
            <Box className="logo-icon">R</Box>

            {!collapsed && (
              <Box className="sidebar-brand">
                <Typography className="logo-title">RetailPulse</Typography>
                <Typography className="logo-subtitle">Analytics</Typography>
              </Box>
            )}
          </Box>
        </Tooltip>
      </Box>

      <Divider className="sidebar-divider" />


    
      <List
        className="sidebar-menu"
        aria-label="Main navigation"
      >

        {navItems
          .filter(
            (item) =>
              !item.adminOnly || isAdmin
          )
          .map((item) => {

            // Check current selected route
            const selected =
              location.pathname === item.path &&
              (
                item.path !== "/dashboard" ||
                item.label === "Dashboard"
              );


            return (
              <Tooltip
                key={item.label}
                title={
                  collapsed
                    ? item.label
                    : ""
                }
                placement="right"
              >

                <ListItemButton
                  selected={selected}
                  onClick={() =>
                    navigate(item.path)
                  }
                  className="sidebar-item"
                >

                  {/* Menu Icon */}
                  <ListItemIcon className="sidebar-icon">
                    {item.icon}
                  </ListItemIcon>


                  {/* Menu Label */}
                  {!collapsed && (
                    <ListItemText
                      primary={item.label}
                      slotProps={{
                        primary: {
                          className:
                            "sidebar-item-label",
                        },
                      }}
                    />
                  )}

                </ListItemButton>

              </Tooltip>
            );
          })}

      </List>


      {/* --------------------------------------------- */}
      {/* Divider */}
      {/* --------------------------------------------- */}

      <Divider className="sidebar-divider" />


      {/* --------------------------------------------- */}
      {/* Theme Section */}
      {/* --------------------------------------------- */}

      <Box className="theme-box">

        {/* ------------------------------------------- */}
        {/* Collapsed Theme Button */}
        {/* ------------------------------------------- */}

        {collapsed ? (

          <Tooltip
            title={`Switch to ${
              mode === "dark"
                ? "light"
                : "dark"
            } mode`}
            placement="right"
          >

            <IconButton
              className="sidebar-theme-toggle"
              onClick={() =>
                setMode(
                  mode === "dark"
                    ? "light"
                    : "dark"
                )
              }
              aria-label="Toggle color mode"
            >

              {mode === "dark" ? (
                <DarkModeOutlinedIcon />
              ) : (
                <LightModeOutlinedIcon />
              )}

            </IconButton>

          </Tooltip>

        ) : (

          /* ------------------------------------------- */
          /* Expanded Theme Select */
          /* ------------------------------------------- */

          <Select
            value={mode}
            onChange={(event) =>
              setMode(
                event.target.value as
                  | "light"
                  | "dark"
              )
            }
            size="small"
            fullWidth
            startAdornment={
              mode === "dark" ? (
                <DarkModeOutlinedIcon
                  className="theme-mode-icon"
                />
              ) : (
                <LightModeOutlinedIcon
                  className="theme-mode-icon"
                />
              )
            }
            className="theme-select"
            MenuProps={{
              slotProps: {
                paper: {
                  sx: {
                    bgcolor: "#1c2340",
                    color: "#fff",
                  },
                },
              },
            }}
          >

            <MenuItem value="light">
              Light mode
            </MenuItem>

            <MenuItem value="dark">
              Dark mode
            </MenuItem>

          </Select>

        )}

      </Box>

    </Box>
  );
}