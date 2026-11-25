import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ProvedorSessao } from "./lib/auth";
import { App } from "./App";

const raiz = document.getElementById("root");
if (!raiz) {
  throw new Error("Elemento #root não encontrado.");
}

createRoot(raiz).render(
  <StrictMode>
    <BrowserRouter>
      <ProvedorSessao>
        <App />
      </ProvedorSessao>
    </BrowserRouter>
  </StrictMode>,
);
