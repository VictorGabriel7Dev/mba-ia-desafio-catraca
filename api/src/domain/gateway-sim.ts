// Gateway de pagamento simulado (modo padrao). Funcao pura, sem I/O: decide o
// resultado e o atraso pelo final do numero do cartao e sorteia o instante de
// resolucao dentro da faixa. Camada de dominio: nao importa infraestrutura.
// Ver docs/specs/_CONVENCOES.md (secao "Gateway simulado").
import type { ResultadoGateway } from "./ingresso";

const QTD_DIGITOS = 16;

// Faixas de atraso (ms): rapida 2 a 5s; lenta 30 a 40s.
const FAIXA_RAPIDA: [number, number] = [2000, 5000];
const FAIXA_LENTA: [number, number] = [30000, 40000];

export interface DecisaoPagamento {
  outcome: ResultadoGateway;
  resolveAt: Date;
}

// Remove espacos e hifens de digitacao; o restante precisa ser 16 digitos.
function normalizar(cardNumber: string): string {
  return cardNumber.replace(/[\s-]/g, "");
}

// Valida o numero do cartao: exatamente 16 digitos (apos remover separadores).
export function cartaoTem16Digitos(cardNumber: unknown): boolean {
  if (typeof cardNumber !== "string") {
    return false;
  }
  return /^\d{16}$/.test(normalizar(cardNumber));
}

// Quatro ultimos digitos, para gravar no Payment (nunca o numero completo).
export function ultimos4(cardNumber: string): string {
  return normalizar(cardNumber).slice(-4);
}

// Sorteia um atraso inteiro de ms dentro da faixa (limites inclusivos).
function sortearMs([min, max]: [number, number]): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Regra do final do cartao: resultado + faixa de atraso.
function regraPeloFinal(final4: string): { outcome: ResultadoGateway; faixa: [number, number] } {
  switch (final4) {
    case "0001":
      return { outcome: "approved", faixa: FAIXA_RAPIDA };
    case "0002":
      return { outcome: "declined", faixa: FAIXA_RAPIDA };
    case "0003":
      return { outcome: "approved", faixa: FAIXA_LENTA };
    case "0004":
      return { outcome: "declined", faixa: FAIXA_LENTA };
    default:
      // Qualquer outro final: recusado em 2 a 5s.
      return { outcome: "declined", faixa: FAIXA_RAPIDA };
  }
}

// Decide o pagamento a partir do cartao e do instante da compra. O outcome e o
// resolveAt (= agora + atraso sorteado na faixa) sao gravados no Payment na hora
// da compra; o worker so observa o relogio chegar em resolveAt. Pressupoe cartao
// valido (quem chama valida com cartaoTem16Digitos antes, respondendo 422).
export function decidirPagamento(cardNumber: string, agora: Date): DecisaoPagamento {
  if (!cartaoTem16Digitos(cardNumber)) {
    throw new Error("decidirPagamento exige um cartao de 16 digitos.");
  }
  const final4 = normalizar(cardNumber).slice(-4);
  const { outcome, faixa } = regraPeloFinal(final4);
  const resolveAt = new Date(agora.getTime() + sortearMs(faixa));
  return { outcome, resolveAt };
}

export { QTD_DIGITOS };
