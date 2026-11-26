// Pagina de gestao de um evento por URL propria (F2, R04): /organizador/eventos/:id.
// Mostra o evento, permite editar e as acoes publicar/cancelar. O acesso a um
// evento de outro organizador e negado pela API (R13) e tratado aqui.
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { useParams } from "react-router-dom";
import {
  cancelarEvento,
  editarEvento,
  obterEventoGestao,
  obterPainelEvento,
  publicarEvento,
  ErroApi,
  type DadosEvento,
  type Evento,
  type PainelEvento,
} from "../lib/api";
import { formatarData, formatarPreco, isoParaLocal } from "../lib/formato";
import { EventoForm } from "../components/EventoForm";

export function EventManagePage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [painel, setPainel] = useState<PainelEvento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(() => {
    if (!id) {
      return;
    }
    setCarregando(true);
    obterEventoGestao(id)
      .then((e) => {
        setEvento(e);
        setErro(null);
        // Painel do evento (F5): numeros carregados em paralelo; uma falha aqui
        // nao derruba a pagina de gestao, so esconde o bloco.
        obterPainelEvento(e.id)
          .then(setPainel)
          .catch(() => setPainel(null));
      })
      .catch((e: unknown) => {
        if (e instanceof ErroApi && e.codigo === "forbidden") {
          setErro("Este evento pertence a outro organizador.");
        } else if (e instanceof ErroApi && e.codigo === "event_not_found") {
          setErro("Evento não encontrado.");
        } else {
          setErro("Não foi possível carregar o evento.");
        }
        setEvento(null);
      })
      .finally(() => setCarregando(false));
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function traduzirErro(e: unknown): string {
    if (e instanceof ErroApi && e.codigo === "capacity_below_occupied") {
      return "A lotação não pode ficar abaixo das vagas já ocupadas.";
    }
    if (e instanceof ErroApi && e.codigo === "invalid_state") {
      return "Ação indisponível para o estado atual do evento.";
    }
    if (e instanceof ErroApi && e.codigo === "invalid_request") {
      return "Verifique os dados do evento.";
    }
    return "Não foi possível concluir a ação.";
  }

  async function editar(dados: DadosEvento): Promise<void> {
    if (!id) {
      return;
    }
    setAviso(null);
    try {
      await editarEvento(id, dados);
      setAviso("Evento atualizado.");
      carregar();
    } catch (e) {
      setAviso(traduzirErro(e));
    }
  }

  async function publicar(): Promise<void> {
    if (!id) {
      return;
    }
    setAviso(null);
    try {
      await publicarEvento(id);
      carregar();
    } catch (e) {
      setAviso(traduzirErro(e));
    }
  }

  async function cancelar(): Promise<void> {
    if (!id) {
      return;
    }
    setAviso(null);
    try {
      await cancelarEvento(id);
      carregar();
    } catch (e) {
      setAviso(traduzirErro(e));
    }
  }

  if (carregando) {
    return <p>Carregando...</p>;
  }
  if (erro || !evento) {
    return <p style={{ color: "crimson" }}>{erro ?? "Evento indisponível."}</p>;
  }

  const editavel = evento.status !== "cancelled";

  return (
    <section>
      <h2>Gestão do evento</h2>
      <p>
        <strong>{evento.name}</strong> - estado: {evento.status}
      </p>
      <p>
        {formatarData(evento.startsAt)} - {evento.location} - {formatarPreco(evento.priceCents)} -
        lotação {evento.capacity}
      </p>

      {painel && (
        <div style={{ margin: "1rem 0" }}>
          <h3>Painel</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            <Numero rotulo="Confirmados" valor={String(painel.confirmados)} />
            <Numero rotulo="Pendentes" valor={String(painel.pendentes)} />
            <Numero rotulo="Check-ins" valor={String(painel.checkins)} />
            <Numero rotulo="Vagas disponíveis" valor={String(painel.vagasDisponiveis)} />
            <Numero rotulo="Receita" valor={formatarPreco(painel.receitaCents)} />
            <Numero rotulo="Estornados" valor={String(painel.estornados)} />
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", margin: "0.5rem 0" }}>
        {evento.status === "draft" && <button onClick={() => void publicar()}>Publicar</button>}
        {editavel && <button onClick={() => void cancelar()}>Cancelar evento</button>}
      </div>

      {editavel ? (
        <>
          <h3>Editar</h3>
          <EventoForm
            rotuloEnvio="Salvar alterações"
            onEnviar={editar}
            iniciais={{
              name: evento.name,
              startsAtLocal: isoParaLocal(evento.startsAt),
              location: evento.location,
              capacity: String(evento.capacity),
              priceReais: (evento.priceCents / 100).toFixed(2),
            }}
          />
        </>
      ) : (
        <p>Evento cancelado: não pode ser editado nem republicado.</p>
      )}

      {aviso && <p>{aviso}</p>}
    </section>
  );
}

// Cartao simples de um numero do painel (rotulo + valor).
function Numero({ rotulo, valor }: { rotulo: string; valor: string }): ReactElement {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "0.5rem",
        padding: "0.5rem 0.75rem",
        minWidth: "7rem",
      }}
    >
      <div style={{ fontSize: "0.8rem", color: "#666" }}>{rotulo}</div>
      <strong style={{ fontSize: "1.25rem" }}>{valor}</strong>
    </div>
  );
}
