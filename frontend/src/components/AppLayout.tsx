import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";
import NavBar from "./NavBar/NavBar";
import Sidebar from "./Sidebar/Sidebar";
// import NavBar from "./NavBar";
// import Sidebar from "./sidebar";
// import Sidebar from "./Sidebar";

export default function AppLayout() {
  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
       <Sidebar/>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <NavBar />
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
