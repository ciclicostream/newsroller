import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import type { Perm } from "@newsroller/shared";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { AjustesClima } from "./pages/AjustesClima";
import { AjustesPlataformas } from "./pages/AjustesPlataformas";
import { AjustesMusica } from "./pages/AjustesMusica";
import { Perfil } from "./pages/Perfil";
import { Papelera } from "./pages/Papelera";
import { Actividad } from "./pages/Actividad";
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
import { Sesiones } from "./pages/Sesiones";
import { SesionEditor } from "./pages/SesionEditor";

function Protected({ children, perm }: { children: React.ReactNode; perm?: Perm }) {
  return (
    <ProtectedRoute perm={perm}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected perm="programar"><Programacion /></Protected>} />
      <Route path="/contenido" element={<Protected perm="contenidos"><NuevoContenido /></Protected>} />
      <Route path="/contenido/papelera" element={<Protected perm="contenidos"><Papelera /></Protected>} />
      <Route path="/contenido/:type" element={<Protected perm="contenidos"><NuevoContenido /></Protected>} />
      <Route path="/plantillas" element={<Protected perm="plantillas_ver"><Plantillas /></Protected>} />
      <Route path="/plantillas/:type" element={<Protected perm="plantillas_ver"><PlantillaContenidos /></Protected>} />
      <Route path="/camaras" element={<Protected perm="camaras"><Camaras /></Protected>} />
      <Route path="/fuentes" element={<Protected perm="fuentes"><Sources /></Protected>} />
      <Route path="/shorts" element={<Protected perm="ajustes"><Shorts /></Protected>} />
      <Route path="/programas" element={<Protected perm="ajustes"><Programas /></Protected>} />
      <Route path="/banco" element={<Protected perm="ajustes"><Banco /></Protected>} />
      <Route path="/reportes" element={<Protected perm="reportes"><Reportes /></Protected>} />
      <Route path="/ajustes" element={<Protected perm="ajustes"><Ajustes /></Protected>} />
      <Route path="/ajustes/actividad" element={<Protected perm="reportes"><Actividad /></Protected>} />
      <Route path="/ajustes/clima" element={<Protected perm="ajustes"><AjustesClima /></Protected>} />
      <Route path="/ajustes/plataformas" element={<Protected perm="ajustes"><AjustesPlataformas /></Protected>} />
      <Route path="/ajustes/musica" element={<Protected perm="ajustes"><AjustesMusica /></Protected>} />
      <Route path="/perfil" element={<Protected><Perfil /></Protected>} />
      <Route path="/usuarios" element={<Protected perm="perfiles"><Users /></Protected>} />
      <Route path="/sesiones" element={<Protected perm="sesiones"><Sesiones /></Protected>} />
      <Route path="/sesiones/:id" element={<Protected perm="sesiones"><SesionEditor /></Protected>} />
    </Routes>
  );
}
