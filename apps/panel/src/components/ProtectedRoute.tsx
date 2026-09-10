import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthProvider";

export function ProtectedRoute({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const { me, loading } = useAuth();
  if (loading) return <div className="center-screen">Cargando…</div>;
  if (!me) return <Navigate to="/login" replace />;
  if (adminOnly && me.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}
