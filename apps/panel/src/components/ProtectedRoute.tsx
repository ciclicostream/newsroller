import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { homeFor, type Perm } from "@newsroller/shared";
import { useAuth } from "../auth/AuthProvider";

// Sólo entra quien tenga el permiso; si no, se lo manda a su sección de inicio.
export function ProtectedRoute({ children, perm }: { children: ReactNode; perm?: Perm }) {
  const { me, loading, can } = useAuth();
  if (loading) return <div className="center-screen">Cargando…</div>;
  if (!me) return <Navigate to="/login" replace />;
  if (perm && !can(perm)) return <Navigate to={homeFor(me.role)} replace />;
  return <>{children}</>;
}
