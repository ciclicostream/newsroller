import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Content } from "./pages/Content";
import { Sources } from "./pages/Sources";
import { Users } from "./pages/Users";

function Protected({ children, adminOnly }: { children: React.ReactNode; adminOnly?: boolean }) {
  return (
    <ProtectedRoute adminOnly={adminOnly}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/contenido" element={<Protected><Content /></Protected>} />
      <Route path="/fuentes" element={<Protected adminOnly><Sources /></Protected>} />
      <Route path="/usuarios" element={<Protected adminOnly><Users /></Protected>} />
    </Routes>
  );
}
