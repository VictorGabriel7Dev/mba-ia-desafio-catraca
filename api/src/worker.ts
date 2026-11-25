// Worker de pagamento (F3). Laco que chama processarPagamentosVencidos(new Date())
// periodicamente: resolve os Payment vencidos cujo ingresso ainda esta pending,
// transitando para confirmed/declined de forma condicional. A funcao vive em
// services/payment-worker.ts (testavel, com relogio injetavel).
import { env } from "./config/env";
import { processarPagamentosVencidos } from "./services/payment-worker";

const INTERVALO_MS = 2000;

function iniciar(): void {
  console.log(`Worker da Catraca iniciado (ambiente ${env.NODE_ENV}).`);
  setInterval(() => {
    void processarPagamentosVencidos(new Date())
      .then((resumo) => {
        if (resumo.processados > 0) {
          console.log(
            `Pagamentos processados: ${resumo.processados} ` +
              `(confirmados ${resumo.confirmados}, recusados ${resumo.recusados}).`,
          );
        }
      })
      .catch((erro) => {
        console.error("Falha ao processar pagamentos vencidos:", erro);
      });
  }, INTERVALO_MS);
}

iniciar();
