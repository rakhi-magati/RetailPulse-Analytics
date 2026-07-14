import { useState, type MouseEvent } from "react";
import {
  Avatar,
  Box,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  TextField,
  Toolbar,
  Typography,
  Divider,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
// import { useAuth } from "../context/AuthContext";

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleMenuOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => setAnchorEl(null);

  const handleLogout = async () => {
    handleMenuClose();
    await logout();
    navigate("/login", { replace: true });
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <Toolbar
      sx={{
        gap: 2,
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        px: { xs: 2, sm: 3 },
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 0, mr: 2 }}>
        Dashboard
      </Typography>

      <TextField
        size="small"
        placeholder="Search anything..."
        sx={{
          flexGrow: 1,
          maxWidth: 340,
          "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "background.default" },
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: "text.disabled" }} />
              </InputAdornment>
            ),
          },
        }}
      />

      <Box sx={{ flexGrow: 1 }} />

      <IconButton size="small">
        <SettingsOutlinedIcon />
      </IconButton>
      <IconButton size="small">
        <NotificationsNoneOutlinedIcon />
      </IconButton>

      <IconButton onClick={handleMenuOpen} size="small" sx={{ ml: 0.5 }}>
        <Avatar sx={{ width: 34, height: 34, bgcolor: "primary.main", fontSize: 14 }}>
          {initials}
        </Avatar>
      </IconButton>

      {user && (
        <Box sx={{ display: { xs: "none", sm: "block" }, textAlign: "left", cursor: "pointer" }} onClick={handleMenuOpen}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.2 }}>
            {user.name}
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: "text.secondary", lineHeight: 1.2 }}>
            {user.role.replace("_", " ")}
          </Typography>
        </Box>
      )}

      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={handleMenuClose}>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            navigate("/profile");
          }}
        >
          <PersonIcon fontSize="small" sx={{ mr: 1 }} />
          My Profile
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
          Logout
        </MenuItem>
      </Menu>
    </Toolbar>
  );
}
