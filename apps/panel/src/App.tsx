import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { AjustesClima } from "./pages/AjustesClima";
import { AjustesPlataformas } from "./pages/AjustesPlataformas";
import { Programacion } from "./pages/Programacion";
import { NuevoContenido } from "./pages/NuevoContenido";
import { Plantillas } from "./pages/Plantillas";
import { PlantillaContenidos } from "./pages/PlantillaContenidos";
import { Camaras } from "./pages/Camaras";
import { Sources } from "./pages/Sources";
import { Shorts } from "./pages/Shorts";
import { Programas } from "./pages/Programas";
import { Banco } from "./pages/Banco";
import { Reportes } from "./pages/Reportes";
import { Ajustes } from "./pages/Ajustes";
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
      <Route path="/" element={<Protected><Programacion /></Protected>} />
      <Route path="/contenido" element={<Protected><NuevoContenido /></Protected>} />
      <Route path="/contenido/:type" element={<Protected><NuevoContenido /></Protected>} />
      <Route path="/plantillas" element={<Protected><Plantillas /></Protected>} />
      <Route path="/plantillas/:type" element={<Protected><PlantillaContenidos /></Protected>} />
      <Route path="/camaras" element={<Protected><Camaras /></Protected>} />
      <Route path="/fuentes" element={<Protected><Sources /></Protected>} />
      <Route path="/shorts" element={<Protected><Shorts /></Protected>} />
      <Route path="/programas" element={<Protected><Programas /></Protected>} />
      <Route path="/banco" element={<Protected><Banco /></Protected>} />
      <Route path="/reportes" element={<Protected><Reportes /></Protected>} />
      <Route path="/ajustes" element={<Protected><Ajustes /></Protected>} />
      <Route path="/ajustes/clima" element={<Protected><AjustesClima /></Protected>} />
      <Route path="/ajustes/plataformas" element={<Protected><AjustesPlataformas /></Protected>} />
      <Route path="/usuarios" element={<Protected adminOnly><Users /></Protected>} />
    </Routes>
  );
}
