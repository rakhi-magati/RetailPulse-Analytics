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
import CategoriesIcon from "@mui/icons-material/CategoryOutlined";
import CustomersIcon from "@mui/icons-material/GroupOutlined";
import InventoryIcon from "@mui/icons-material/WarehouseOutlined";
import ReportsIcon from "@mui/icons-material/DescriptionOutlined";
import AlertsIcon from "@mui/icons-material/NotificationsNoneOutlined";
import UsersIcon from "@mui/icons-material/BadgeOutlined";
import SettingsIcon from "@mui/icons-material/SettingsOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";

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
  { label: "Categories", icon: <CategoriesIcon />, path: "/categories" },
  { label: "Customers", icon: <CustomersIcon />, path: "/customers" },
  { label: "Inventory", icon: <InventoryIcon />, path: "/inventory" },
  { label: "Reports", icon: <ReportsIcon />, path: "/dashboard" },
  { label: "Alerts", icon: <AlertsIcon />, path: "/dashboard" },
  { label: "Users", icon: <UsersIcon />, path: "/dashboard" },
  { label: "Settings", icon: <SettingsIcon />, path: "/profile" },
];

const SIDEBAR_WIDTH = 240;

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("Light");

  return (
    <Box
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        height: "100vh",
        position: "sticky",
        top: 0,
        bgcolor: "#0F1535",
        color: "rgba(255,255,255,0.75)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, px: 2.5, py: 2.75 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: "10px",
            background: "linear-gradient(135deg, #7C6BF0, #4F46E5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 15,
            color: "#fff",
          }}
        >
          R
        </Box>
        <Box>
          <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
            RetailPulse
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.45)", fontSize: 11.5, lineHeight: 1.2 }}>
            Analytics
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

      <List sx={{ px: 1.5, py: 1.5, flexGrow: 1 }}>
        {navItems.map((item) => {
          const selected =
            location.pathname === item.path &&
            (item.path !== "/dashboard" || item.label === "Dashboard");
          return (
            <ListItemButton
              key={item.label}
              selected={selected}
              onClick={() => navigate(item.path)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                py: 1,
                color: selected ? "#fff" : "rgba(255,255,255,0.65)",
                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "#fff",
                },
                "&.Mui-selected:hover": {
                  bgcolor: "primary.main",
                },
                "&:hover": {
                  bgcolor: "rgba(255,255,255,0.06)",
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 36,
                  color: selected ? "#fff" : "rgba(255,255,255,0.55)",
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{ primary: { sx: { fontSize: 14, fontWeight: selected ? 600 : 500 } } }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

      <Box sx={{ p: 2 }}>
        <Select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          size="small"
          fullWidth
          startAdornment={
            <LightModeOutlinedIcon sx={{ fontSize: 18, mr: 1, color: "rgba(255,255,255,0.6)" }} />
          }
          sx={{
            color: "rgba(255,255,255,0.75)",
            fontSize: 13,
            bgcolor: "rgba(255,255,255,0.06)",
            ".MuiOutlinedInput-notchedOutline": { border: "none" },
            ".MuiSvgIcon-root": { color: "rgba(255,255,255,0.5)" },
          }}
          MenuProps={{ slotProps: { paper: { sx: { bgcolor: "#1c2340", color: "#fff" } } } }}
        >
          <MenuItem value="Light">Light</MenuItem>
          <MenuItem value="Dark">Dark</MenuItem>
        </Select>
      </Box>
    </Box>
  );
}
