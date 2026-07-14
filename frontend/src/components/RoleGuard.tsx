import type { ReactNode } from "react";
import { Alert } from "@mui/material";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../types/auth";

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export default function RoleGuard({
  allowedRoles,
  children,
  fallback,
}: RoleGuardProps) {
  const { user } = useAuth();

  if (!user) return null;

  const isAllowed =
    user.role === "SUPER_ADMIN" || allowedRoles.includes(user.role);

  if (!isAllowed) {
    return (
      <>
        {fallback ?? (
          <Alert severity="warning">
            You don't have permission to view this section.
          </Alert>
        )}
      </>
    );
  }

  return <>{children}</>;
}
