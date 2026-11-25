// Vitrine publica: lista os eventos publicados (F2) e permite comprar ingresso
// (F3). O participante logado informa o cartao e compra; sem vaga, a vitrine
// mostra "Ingressos esgotados". Visitante e convidado a entrar para comprar.
import { useEffect, useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { useSessao } from "../lib/auth";
import { comprarIngresso, listarVitrine, ErroApi, type Evento } from "../lib/api";
import { formatarData, formatarPreco, rotuloStatusIngresso } from "../lib/formato";

// Estado da compra por evento (mensagem exibida embaixo do card).
type EstadoCompra = { tipo: "ok"; codigo: string; status: string } | { tipo: "erro"; mensagem: string };

function CompraEvento({ eventoId }: { eventoId: string }): ReactElement {
  const [cardNumber, setCardNumber] = useState("");
  const [estado, setEstado] = useState<EstadoCompra | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function comprar(): Promise<void> {
    setEstado(null);
    setEnviando(true);
    try {
      const ingresso = await comprarIngresso(eventoId, cardNumber);
      setEstado({ tipo: "ok", codigo: ingresso.code, status: rotuloStatusIngresso(ingresso.status) });
      setCardNumber("");
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === "sold_out") {
        setEstado({ tipo: "erro", mensagem: "Ingressos esgotados" });
      } else if (e instanceof ErroApi && e.codigo === "invalid_request") {
        setEstado({ tipo: "erro", mensagem: "Cartao deve ter 16 digitos." });
      } else if (e instanceof ErroApi && e.codigo === "event_not_available") {
        setEstado({ tipo: "erro", mensagem: "Evento indisponivel para compra." });
      } else {
        setEstado({ tipo: "erro", mensagem: "Nao foi possivel comprar." });
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.35rem" }}>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          placeholder="Numero do cartao (16 digitos)"
          value={cardNumber}
          onChange={(e) => setCardNumber(e.target.value)}
          style={{ flex: 1 }}
        />
        <button onClick={() => void comprar()} disabled={enviando}>
          {enviando ? "Comprando..." : "Comprar"}
        </button>
      </div>
      {estado?.tipo === "ok" && (
        <p style={{ margin: 0, color: "green" }}>
          Ingresso {estado.status}. Codigo: <strong>{estado.codigo}</strong>
        </p>
      )}
      {estado?.tipo === "erro" && <p style={{ margin: 0, color: "crimson" }}>{estado.mensagem}</p>}
    </div>
  );
}

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
          Ola, {usuario.name} ({usuario.role}).{" "}
          <Link to="/meus-ingressos">Meus ingressos</Link>{" "}
          <button onClick={() => void fazerLogout()}>Sair</button>
        </p>
      ) : (
        <p>Visitante. Faca login ou cadastre-se para comprar ingressos.</p>
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
              {formatarPreco(evento.priceCents)} - lotacao {evento.capacity}
            </p>
            {usuario ? (
              <CompraEvento eventoId={evento.id} />
            ) : (
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem" }}>
                <Link to="/login">Entre</Link> para comprar.
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
