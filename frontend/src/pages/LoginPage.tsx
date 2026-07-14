import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  TextField,
  Typography,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import StorefrontIcon from "@mui/icons-material/Storefront";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import { isAxiosError } from "axios";
import { useAuth } from "../context/AuthContext";
import type { LoginRequest } from "../types/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>({
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginRequest) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await login(values);
      const redirectTo =
        (location.state as { from?: Location })?.from?.pathname ?? "/dashboard";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (isAxiosError(err) && err.response?.data?.detail) {
        setServerError(String(err.response.data.detail));
      } else {
        setServerError("Login failed. Please check your credentials.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: { xs: 0, sm: 3 },
      }}
    >
      <Box
        sx={{
          display: "flex",
          width: "100%",
          maxWidth: 940,
          minHeight: { sm: 560 },
          borderRadius: { xs: 0, sm: 4 },
          overflow: "hidden",
          boxShadow: { xs: "none", sm: "0 20px 60px rgba(15,21,53,0.15)" },
        }}
      >
        {/* Left brand panel */}
        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            justifyContent: "space-between",
            width: "44%",
            p: 5,
            position: "relative",
            overflow: "hidden",
            background: "linear-gradient(160deg, #12183A 0%, #1B1F4B 55%, #2A2470 100%)",
            color: "#fff",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
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
              }}
            >
              R
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>
                RetailPulse
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.2 }}>
                Analytics
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              position: "relative",
              flexGrow: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              my: 4,
            }}
          >
            <Box
              sx={{
                position: "absolute",
                width: 220,
                height: 220,
                borderRadius: "50%",
                bgcolor: "rgba(124,107,240,0.18)",
                filter: "blur(4px)",
              }}
            />
            <ShoppingBagIcon sx={{ fontSize: 96, position: "relative", zIndex: 1, opacity: 0.95 }} />
            <Box
              sx={{
                position: "absolute",
                top: 24,
                right: 28,
                width: 46,
                height: 46,
                borderRadius: 2,
                bgcolor: "rgba(79,70,229,0.85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShowChartIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box
              sx={{
                position: "absolute",
                bottom: 30,
                left: 20,
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: "rgba(255,171,64,0.85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <StorefrontIcon sx={{ fontSize: 20 }} />
            </Box>
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20, mb: 0.5 }}>
              Make smarter retail decisions
            </Typography>
            <Typography sx={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>
              with real-time analytics
            </Typography>
          </Box>
        </Box>

        {/* Right form panel */}
        <Box
          sx={{
            flexGrow: 1,
            bgcolor: "background.paper",
            p: { xs: 4, sm: 6 },
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Welcome Back
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Sign in to your account
          </Typography>

          {serverError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {serverError}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
              Email
            </Typography>
            <TextField
              fullWidth
              type="email"
              placeholder="you@company.com"
              size="small"
              autoFocus
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Enter a valid email",
                },
              })}
              error={!!errors.email}
              helperText={errors.email?.message}
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Password
              </Typography>
              <Link component={RouterLink} to="/login" variant="body2" underline="hover">
                Forgot Password?
              </Link>
            </Box>
            <TextField
              fullWidth
              type={showPassword ? "text" : "password"}
              placeholder="••••••••••"
              size="small"
              {...register("password", { required: "Password is required" })}
              error={!!errors.password}
              helperText={errors.password?.message}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setShowPassword((prev) => !prev)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <FormControlLabel
              control={<Checkbox defaultChecked size="small" />}
              label={<Typography variant="body2">Remember me</Typography>}
              sx={{ mt: 0.5 }}
            />

            <Button
              type="submit"
              fullWidth
              size="large"
              variant="contained"
              disabled={submitting}
              sx={{ mt: 2, py: 1.3 }}
            >
              {submitting ? "Signing in..." : "Sign In"}
            </Button>

            <Typography variant="body2" align="center" sx={{ mt: 3 }}>
              Don't have an account?{" "}
              <Link component={RouterLink} to="/register">
                Register
              </Link>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
