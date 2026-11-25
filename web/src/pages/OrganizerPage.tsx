// Área do organizador (esqueleto da F1, protegida pela guarda de rota).
// F2 preenche a gestão de eventos.
import type { ReactElement } from "react";
import { useSessao } from "../lib/auth";

export function OrganizerPage(): ReactElement {
  const { usuario } = useSessao();
  return (
    <section>
      <h2>Área do organizador</h2>
      <p>Bem-vindo, {usuario?.name}. A gestão de eventos entra na F2.</p>
    </section>
  );
}
