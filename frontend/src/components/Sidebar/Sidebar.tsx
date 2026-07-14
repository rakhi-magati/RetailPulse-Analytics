import { useState } from "react";
import {
  Box,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Select,
  MenuItem,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

import DashboardIcon from "@mui/icons-material/DashboardOutlined";
import AnalyticsIcon from "@mui/icons-material/BarChartOutlined";
import SalesIcon from "@mui/icons-material/StorefrontOutlined";
import ProductsIcon from "@mui/icons-material/Inventory2Outlined";
import CustomersIcon from "@mui/icons-material/GroupOutlined";
import InventoryIcon from "@mui/icons-material/WarehouseOutlined";
import ReportsIcon from "@mui/icons-material/DescriptionOutlined";
import AlertsIcon from "@mui/icons-material/NotificationsNoneOutlined";
import UsersIcon from "@mui/icons-material/BadgeOutlined";
import SettingsIcon from "@mui/icons-material/SettingsOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";

import "./Sidebar.css";

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: <DashboardIcon />, path: "/dashboard" },
  { label: "Analytics", icon: <AnalyticsIcon />, path: "/analytics" },
  { label: "Sales", icon: <SalesIcon />, path: "/sales" },
  { label: "Products", icon: <ProductsIcon />, path: "/products" },
  { label: "Customers", icon: <CustomersIcon />, path: "/customers" },
  { label: "Inventory", icon: <InventoryIcon />, path: "/inventory" },
  { label: "Reports", icon: <ReportsIcon />, path: "/reports" },
  { label: "Alerts", icon: <AlertsIcon />, path: "/alerts" },
  { label: "Users", icon: <UsersIcon />, path: "/users" },
  { label: "Settings", icon: <SettingsIcon />, path: "/profile" },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState("Light");

  return (
    <Box className="sidebar">

      <Box className="sidebar-logo">
        <Box className="logo-icon">R</Box>

        <Box>
          <Typography className="logo-title">
            RetailPulse
          </Typography>

          <Typography className="logo-subtitle">
            Analytics
          </Typography>
        </Box>
      </Box>

      <Divider className="sidebar-divider" />

      <List className="sidebar-menu">

        {navItems.map((item) => {
          const selected = location.pathname === item.path;

          return (
            <ListItemButton
              key={item.label}
              selected={selected}
              onClick={() => navigate(item.path)}
              className={`sidebar-item ${selected ? "active" : ""}`}
            >
              <ListItemIcon className="sidebar-icon">
                {item.icon}
              </ListItemIcon>

              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>

      <Divider className="sidebar-divider" />

      <Box className="theme-box">

        <Select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          fullWidth
          size="small"
          startAdornment={<LightModeOutlinedIcon />}
          className="theme-select"
        >
          <MenuItem value="Light">Light</MenuItem>
          <MenuItem value="Dark">Dark</MenuItem>
        </Select>

      </Box>

    </Box>
  );
}