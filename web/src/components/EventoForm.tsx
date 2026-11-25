// Formulario de criar/editar evento. Recebe valores iniciais e devolve os dados
// prontos (preco em centavos, data em ISO) para o chamador enviar a API.
import { useState, type FormEvent, type ReactElement } from "react";
import type { DadosEvento } from "../lib/api";
import { localParaIso } from "../lib/formato";

export interface ValoresIniciais {
  name: string;
  startsAtLocal: string;
  location: string;
  capacity: string;
  priceReais: string;
}

const VAZIO: ValoresIniciais = {
  name: "",
  startsAtLocal: "",
  location: "",
  capacity: "",
  priceReais: "",
};

export function EventoForm({
  iniciais = VAZIO,
  rotuloEnvio,
  onEnviar,
}: {
  iniciais?: ValoresIniciais;
  rotuloEnvio: string;
  onEnviar: (dados: DadosEvento) => Promise<void>;
}): ReactElement {
  const [name, setName] = useState(iniciais.name);
  const [startsAtLocal, setStartsAtLocal] = useState(iniciais.startsAtLocal);
  const [location, setLocation] = useState(iniciais.location);
  const [capacity, setCapacity] = useState(iniciais.capacity);
  const [priceReais, setPriceReais] = useState(iniciais.priceReais);

  async function enviar(evento: FormEvent): Promise<void> {
    evento.preventDefault();
    await onEnviar({
      name,
      startsAt: localParaIso(startsAtLocal),
      location,
      capacity: Number(capacity),
      priceCents: Math.round(Number(priceReais) * 100),
    });
  }

  return (
    <form onSubmit={enviar} style={{ display: "grid", gap: "0.5rem", maxWidth: 360 }}>
      <input placeholder="Nome do evento" value={name} onChange={(e) => setName(e.target.value)} />
      <label>
        Início
        <input
          type="datetime-local"
          value={startsAtLocal}
          onChange={(e) => setStartsAtLocal(e.target.value)}
        />
      </label>
      <input placeholder="Local" value={location} onChange={(e) => setLocation(e.target.value)} />
      <input
        type="number"
        placeholder="Lotação"
        value={capacity}
        onChange={(e) => setCapacity(e.target.value)}
      />
      <input
        type="number"
        step="0.01"
        placeholder="Preço (R$)"
        value={priceReais}
        onChange={(e) => setPriceReais(e.target.value)}
      />
      <button type="submit">{rotuloEnvio}</button>
    </form>
  );
}
