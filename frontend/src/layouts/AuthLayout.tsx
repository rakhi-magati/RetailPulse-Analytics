// import { ReactNode } from "react";
// import { Box, Stack, Typography } from "@mui/material";

// /**
//  * Shared shell for /login, /register, /forgot-password.
//  * Left: dark brand panel with logo + illustration + tagline (hidden on small screens).
//  * Right: the actual form content, passed in as children.
//  */
// export default function AuthLayout({ children }: { children: ReactNode }) {
//   return (
//     <Box
//       sx={{
//         minHeight: "100vh",
//         display: "flex",
//         bgcolor: "#F4F5FA",
//       }}
//     >
//       {/* Brand panel */}
//       <Box
//         sx={{
//           display: { xs: "none", md: "flex" },
//           flexDirection: "column",
//           justifyContent: "space-between",
//           width: 440,
//           flexShrink: 0,
//           m: 2,
//           borderRadius: 4,
//           p: 5,
//           position: "relative",
//           overflow: "hidden",
//           background: "linear-gradient(160deg, #10173A 0%, #171E45 55%, #1E2359 100%)",
//           color: "#fff",
//         }}
//       >
//         {/* ambient glow blobs */}
//         <Box
//           sx={{
//             position: "absolute",
//             width: 280,
//             height: 280,
//             borderRadius: "50%",
//             top: -80,
//             right: -80,
//             background: "radial-gradient(circle, rgba(124,109,242,0.35) 0%, rgba(124,109,242,0) 70%)",
//           }}
//         />
//         <Box
//           sx={{
//             position: "absolute",
//             width: 260,
//             height: 260,
//             borderRadius: "50%",
//             bottom: -60,
//             left: -60,
//             background: "radial-gradient(circle, rgba(56,189,248,0.25) 0%, rgba(56,189,248,0) 70%)",
//           }}
//         />

//         {/* Logo + wordmark */}
//         <Stack direction="row" alignItems="center" spacing={1.5} sx={{ position: "relative", zIndex: 1 }}>
//           <Box
//             component="svg"
//             width={40}
//             height={40}
//             viewBox="0 0 40 40"
//             fill="none"
//             xmlns="http://www.w3.org/2000/svg"
//           >
//             <defs>
//               <linearGradient id="logoGrad" x1="0" y1="0" x2="1" y2="1">
//                 <stop offset="0%" stopColor="#818CF8" />
//                 <stop offset="100%" stopColor="#6366F1" />
//               </linearGradient>
//             </defs>
//             <circle cx="20" cy="20" r="20" fill="url(#logoGrad)" />
//             <path d="M20 4a16 16 0 0 1 0 32V4Z" fill="#ffffff" fillOpacity="0.9" />
//           </Box>
//           <Box>
//             <Typography variant="h6" fontWeight={800} lineHeight={1.1}>
//               RetailPulse
//             </Typography>
//             <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.65)", letterSpacing: 1 }}>
//               Analytics
//             </Typography>
//           </Box>
//         </Stack>

//         {/* Illustration */}
//         <Box sx={{ position: "relative", zIndex: 1, my: 4 }}>
//           <RetailIllustration />
//         </Box>

//         {/* Tagline */}
//         <Typography
//           variant="subtitle1"
//           sx={{ position: "relative", zIndex: 1, color: "rgba(255,255,255,0.85)", fontWeight: 500, lineHeight: 1.5 }}
//         >
//           Make smarter retail decisions with real-time analytics
//         </Typography>
//       </Box>

//       {/* Form panel */}
//       <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", px: 2 }}>
//         {children}
//       </Box>
//     </Box>
//   );
// }

// function RetailIllustration() {
//   return (
//     <Box component="svg" viewBox="0 0 320 220" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg">
//       {/* soft floor shadow */}
//       <ellipse cx="150" cy="195" rx="110" ry="12" fill="rgba(255,255,255,0.06)" />

//       {/* shopping cart */}
//       <g transform="translate(50,60)">
//         <path
//           d="M0 0h16l10 78h108l16-58H36"
//           stroke="#C7CCFB"
//           strokeWidth="6"
//           strokeLinecap="round"
//           strokeLinejoin="round"
//           fill="none"
//         />
//         <circle cx="40" cy="108" r="10" fill="#8B93F8" />
//         <circle cx="118" cy="108" r="10" fill="#8B93F8" />
//       </g>

//       {/* left bag */}
//       <g transform="translate(8,120)">
//         <rect x="0" y="14" width="48" height="46" rx="6" fill="#F5A623" />
//         <path d="M10 14 V4a14 14 0 0 1 28 0v10" stroke="#B97600" strokeWidth="4" fill="none" strokeLinecap="round" />
//       </g>

//       {/* right bag */}
//       <g transform="translate(210,110)">
//         <rect x="0" y="18" width="52" height="50" rx="6" fill="#5B8CFF" />
//         <path d="M11 18 V6a15 15 0 0 1 30 0v12" stroke="#2A4FD6" strokeWidth="4" fill="none" strokeLinecap="round" />
//       </g>

//       {/* analytics card */}
//       <g transform="translate(178,10)">
//         <rect x="0" y="0" width="56" height="46" rx="10" fill="#7C6DF2" />
//         <path
//           d="M10 32 L20 20 L30 26 L46 10"
//           stroke="#ffffff"
//           strokeWidth="3.5"
//           fill="none"
//           strokeLinecap="round"
//           strokeLinejoin="round"
//         />
//         <circle cx="46" cy="10" r="3.5" fill="#ffffff" />
//       </g>

//       {/* decorative sparkles */}
//       <g fill="#8B93F8">
//         <circle cx="30" cy="30" r="2.5" />
//         <circle cx="270" cy="60" r="2" />
//         <circle cx="290" cy="150" r="2.5" />
//         <circle cx="20" cy="170" r="2" />
//       </g>
//     </Box>
//   );
// }