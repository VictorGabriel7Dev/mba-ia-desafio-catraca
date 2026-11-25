// Vitrine publica: lista os eventos publicados (F2). Visitante, participante e
// organizador veem a mesma lista; a compra entra na F3.
import { useEffect, useState, type ReactElement } from "react";
import { useSessao } from "../lib/auth";
import { listarVitrine, type Evento } from "../lib/api";
import { formatarData, formatarPreco } from "../lib/formato";

export function HomePage(): ReactElement {
  const { usuario, fazerLogout } = useSessao();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    listarVitrine()
      .then(setEventos)
      .catch(() => setEventos([]))
      .finally(() => setCarregando(false));
  }, []);

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

      {carregando && <p>Carregando eventos...</p>}
      {!carregando && eventos.length === 0 && <p>Nenhum evento publicado no momento.</p>}

      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "1rem" }}>
        {eventos.map((evento) => (
          <li key={evento.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem" }}>
            <h3 style={{ margin: "0 0 0.25rem" }}>{evento.name}</h3>
            <p style={{ margin: 0 }}>{formatarData(evento.startsAt)}</p>
            <p style={{ margin: 0 }}>{evento.location}</p>
            <p style={{ margin: "0.25rem 0 0" }}>
              {formatarPreco(evento.priceCents)} - lotação {evento.capacity}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
