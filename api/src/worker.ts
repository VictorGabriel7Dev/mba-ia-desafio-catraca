// Worker de pagamento. Em F1 é um laço no-op que só registra que subiu;
// F3 preenche a função processarPagamentosVencidos(agora) e o laço real.
import { env } from "./config/env";

const INTERVALO_MS = 2000;

function iniciar(): void {
  // eslint-disable-next-line no-console
  console.log(`Worker da Catraca iniciado (ambiente ${env.NODE_ENV}). Aguardando F3.`);
  setInterval(() => {
    // No-op nesta rodada. F3 chamará processarPagamentosVencidos(new Date()) aqui.
  }, INTERVALO_MS);
}

iniciar();
