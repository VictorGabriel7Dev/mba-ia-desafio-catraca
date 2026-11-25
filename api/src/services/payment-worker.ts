// Processamento assincrono dos pagamentos (F3). Funcao pura-de-orquestracao e
// testavel: pega os Payment cujo resolveAt ja venceu e cujo ingresso ainda esta
// pending, e transita de forma CONDICIONAL (approved -> confirmed, declined ->
// declined). Recusado nao precisa "liberar vaga" explicitamente: ocupadas conta
// apenas pending + confirmed, entao declined ja sai da conta. O worker chama esta
// funcao periodicamente com new Date(); os testes adiantam o relogio passando um
// `agora` no futuro (R08). Nunca toca em Prisma nem em Express.
import { statusAposGateway } from "../domain/ingresso";
import * as pagamentos from "../repositories/payment-repository";

export interface ResumoProcessamento {
  processados: number;
  confirmados: number;
  recusados: number;
}

export async function processarPagamentosVencidos(agora: Date): Promise<ResumoProcessamento> {
  const vencidos = await pagamentos.listarVencidosNaoProcessados(agora);
  let confirmados = 0;
  let recusados = 0;

  for (const pagamento of vencidos) {
    const novoStatus = statusAposGateway(pagamento.outcome);
    await pagamentos.aplicarResolucao(pagamento.id, pagamento.ticketId, novoStatus, agora);
    if (novoStatus === "confirmed") {
      confirmados += 1;
    } else {
      recusados += 1;
    }
  }

  return { processados: vencidos.length, confirmados, recusados };
}
