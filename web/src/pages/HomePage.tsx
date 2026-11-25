// Vitrine (esqueleto da F1). F2 preenche a lista de eventos publicados.
import type { ReactElement } from "react";
import { useSessao } from "../lib/auth";

export function HomePage(): ReactElement {
  const { usuario, fazerLogout } = useSessao();
  return (
    <section>
      <h2>Vitrine</h2>
      {usuario ? (
        <p>
          Olá, {usuario.name} ({usuario.role}).{" "}
          <button onClick={() => void fazerLogout()}>Sair</button>
        </p>
      ) : (
        <p>Visitante. Faça login ou cadastre-se para comprar ingressos.</p>
      )}
      <p>Os eventos publicados aparecem aqui a partir da F2.</p>
    </section>
  );
}
