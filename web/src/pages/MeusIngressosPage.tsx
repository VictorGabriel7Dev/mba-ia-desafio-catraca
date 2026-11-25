// "Meus ingressos" (F3): lista os ingressos do participante logado com evento,
// status e codigo. Esqueleto funcional; visual nao avaliado.
import { useEffect, useState, type ReactElement } from "react";
import { meusIngressos, type IngressoComEvento } from "../lib/api";
import { formatarData } from "../lib/formato";

export function MeusIngressosPage(): ReactElement {
  const [ingressos, setIngressos] = useState<IngressoComEvento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    meusIngressos()
      .then(setIngressos)
      .catch(() => setIngressos([]))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return <p>Carregando...</p>;
  }

  return (
    <section>
      <h2>Meus ingressos</h2>
      {ingressos.length === 0 && <p>Voce ainda nao comprou ingressos.</p>}
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem" }}>
        {ingressos.map((ingresso) => (
          <li
            key={ingresso.id}
            style={{ border: "1px solid #ddd", borderRadius: 8, padding: "0.75rem" }}
          >
            <strong>{ingresso.evento.name}</strong>
            <br />
            {formatarData(ingresso.evento.startsAt)} - {ingresso.evento.location}
            <br />
            Status: {ingresso.statusLabel}
            <br />
            Codigo: <code>{ingresso.code}</code>
          </li>
        ))}
      </ul>
    </section>
  );
}
