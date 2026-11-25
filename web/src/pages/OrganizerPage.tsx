// Area do organizador (F2): lista os proprios eventos, cria um novo e leva a
// pagina de gestao por URL propria (/organizador/eventos/:id).
import { useCallback, useEffect, useState, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { useSessao } from "../lib/auth";
import { criarEvento, listarMeusEventos, ErroApi, type DadosEvento, type Evento } from "../lib/api";
import { formatarData, formatarPreco } from "../lib/formato";
import { EventoForm } from "../components/EventoForm";

export function OrganizerPage(): ReactElement {
  const { usuario } = useSessao();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(() => {
    listarMeusEventos()
      .then(setEventos)
      .catch(() => setEventos([]));
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  async function criar(dados: DadosEvento): Promise<void> {
    setErro(null);
    try {
      await criarEvento(dados);
      recarregar();
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === "invalid_request") {
        setErro("Verifique os dados: nome, local, data futura, lotação >= 1 e preço > 0.");
      } else {
        setErro("Não foi possível criar o evento.");
      }
    }
  }

  return (
    <section>
      <h2>Área do organizador</h2>
      <p>Bem-vindo, {usuario?.name}.</p>

      <h3>Novo evento</h3>
      <EventoForm rotuloEnvio="Criar evento" onEnviar={criar} />
      {erro && <p style={{ color: "crimson" }}>{erro}</p>}

      <h3>Meus eventos</h3>
      {eventos.length === 0 && <p>Você ainda não criou eventos.</p>}
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem" }}>
        {eventos.map((evento) => (
          <li key={evento.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "0.75rem" }}>
            <strong>{evento.name}</strong> ({evento.status})
            <br />
            {formatarData(evento.startsAt)} - {formatarPreco(evento.priceCents)}
            <br />
            <Link to={`/organizador/eventos/${evento.id}`}>Gerenciar</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
