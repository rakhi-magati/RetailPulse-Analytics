import { useState, type MouseEvent } from "react";
import { Avatar, Badge, Box, IconButton, InputAdornment, Menu, MenuItem, TextField, Toolbar, Typography, Divider, Tooltip } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonIcon from "@mui/icons-material/Person";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { notificationsApi } from "../../api/notifications";

export default function NavBar() {
  const { user, logout } = useAuth(); const navigate = useNavigate(); const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const unread = useQuery({ queryKey:["notification-unread-count"], queryFn: notificationsApi.unreadCount, refetchInterval:15000, enabled:!!user });
  const handleMenuOpen = (event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  const handleLogout = async () => { handleMenuClose(); await logout(); navigate("/login", { replace: true }); };
  const initials = user?.name ? user.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase() : "?";
  return <Toolbar sx={{ gap:2, bgcolor:"background.paper", borderBottom:"1px solid", borderColor:"divider", px:{xs:2,sm:3} }}>
    <Typography variant="h6" sx={{ fontWeight:700, mr:2 }}>Dashboard</Typography><TextField size="small" placeholder="Search anything..." sx={{ flexGrow:1,maxWidth:340,"& .MuiOutlinedInput-root":{borderRadius:2,bgcolor:"background.default"} }} slotProps={{ input:{ startAdornment:<InputAdornment position="start"><SearchIcon fontSize="small" sx={{color:"text.disabled"}}/></InputAdornment> } }}/><Box sx={{flexGrow:1}}/><IconButton size="small"><SettingsOutlinedIcon/></IconButton><Tooltip title="Notification Center"><IconButton size="small" onClick={() => navigate("/notifications")} aria-label="Open notifications"><Badge badgeContent={unread.data?.count ?? 0} color="error" max={99}><NotificationsNoneOutlinedIcon/></Badge></IconButton></Tooltip><IconButton onClick={handleMenuOpen} size="small" sx={{ml:.5}}><Avatar sx={{width:34,height:34,bgcolor:"primary.main",fontSize:14}}>{initials}</Avatar></IconButton>{user && <Box sx={{display:{xs:"none",sm:"block"},textAlign:"left",cursor:"pointer"}} onClick={handleMenuOpen}><Typography sx={{fontSize:13.5,fontWeight:600,lineHeight:1.2}}>{user.name}</Typography><Typography sx={{fontSize:11.5,color:"text.secondary",lineHeight:1.2}}>{user.role.replace("_"," ")}</Typography></Box>}<Menu anchorEl={anchorEl} open={!!anchorEl} onClose={handleMenuClose}><MenuItem onClick={() => {handleMenuClose();navigate("/profile")}}><PersonIcon fontSize="small" sx={{mr:1}}/>My Profile</MenuItem><Divider/><MenuItem onClick={handleLogout}><LogoutIcon fontSize="small" sx={{mr:1}}/>Logout</MenuItem></Menu>
  </Toolbar>;
}