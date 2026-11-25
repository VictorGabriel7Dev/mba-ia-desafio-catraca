// Regras puras do evento: invariantes de dados, maquina de estados do ciclo de
// vida (draft -> published -> cancelled) e a regra da lotacao (nunca abaixo das
// vagas ocupadas). Camada de dominio: nao importa infraestrutura (sem Prisma,
// sem Express, sem env). Ver docs/specs/_CONVENCOES.md.

export type StatusEvento = "draft" | "published" | "cancelled";

// Nome e local sao textos obrigatorios e nao vazios.
export function nomeEventoValido(nome: unknown): boolean {
  return typeof nome === "string" && nome.trim().length >= 1;
}

export function localValido(local: unknown): boolean {
  return typeof local === "string" && local.trim().length >= 1;
}

// Lotacao: inteiro maior ou igual a 1.
export function capacidadeValida(capacity: unknown): boolean {
  return typeof capacity === "number" && Number.isInteger(capacity) && capacity >= 1;
}

// Preco em centavos: inteiro positivo (maior que zero).
export function precoValido(priceCents: unknown): boolean {
  return typeof priceCents === "number" && Number.isInteger(priceCents) && priceCents > 0;
}

// startsAt tem que ser uma data valida e no futuro em relacao a "agora".
export function dataValidaEFutura(startsAt: Date, agora: Date): boolean {
  return !Number.isNaN(startsAt.getTime()) && startsAt.getTime() > agora.getTime();
}

// Maquina de estados. Transicoes validas: draft -> published, draft -> cancelled,
// published -> cancelled. Nunca sai de cancelled (irreversivel).
export function transicaoValida(de: StatusEvento, para: StatusEvento): boolean {
  if (de === "draft") {
    return para === "published" || para === "cancelled";
  }
  if (de === "published") {
    return para === "cancelled";
  }
  // cancelled e terminal.
  return false;
}

export function podePublicar(status: StatusEvento): boolean {
  return transicaoValida(status, "published");
}

export function podeCancelar(status: StatusEvento): boolean {
  return transicaoValida(status, "cancelled");
}

// So se edita evento que nao esta cancelado (rascunho ou publicado).
export function podeEditar(status: StatusEvento): boolean {
  return status !== "cancelled";
}

// A lotacao nunca pode cair abaixo das vagas ja ocupadas; aumentar sempre pode.
export function capacidadeComportaOcupadas(novaCapacidade: number, ocupadas: number): boolean {
  return novaCapacidade >= ocupadas;
}
