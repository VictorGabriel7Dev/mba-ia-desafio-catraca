// Rotas do front: home, cadastro, login e área de organizador com guarda de rota.
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { useSessao } from "./lib/auth";
import { HomePage } from "./pages/HomePage";
import { RegisterPage } from "./pages/RegisterPage";
import { LoginPage } from "./pages/LoginPage";
import { OrganizerPage } from "./pages/OrganizerPage";
import { EventManagePage } from "./pages/EventManagePage";
import type { ReactElement } from "react";

// Guarda de rota: só organizador autenticado entra na área de organizador.
function GuardaOrganizador({ children }: { children: ReactElement }): ReactElement {
  const { usuario, carregando } = useSessao();
  if (carregando) {
    return <p>Carregando...</p>;
  }
  if (!usuario || usuario.role !== "organizer") {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export function App(): ReactElement {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        <h1>Catraca</h1>
        <nav style={{ display: "flex", gap: "1rem" }}>
          <Link to="/">Vitrine</Link>
          <Link to="/cadastro">Cadastro</Link>
          <Link to="/login">Entrar</Link>
          <Link to="/organizador">Área do organizador</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/organizador"
            element={
              <GuardaOrganizador>
                <OrganizerPage />
              </GuardaOrganizador>
            }
          />
          <Route
            path="/organizador/eventos/:id"
            element={
              <GuardaOrganizador>
                <EventManagePage />
              </GuardaOrganizador>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
