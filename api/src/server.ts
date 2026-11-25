// Ponto de entrada do servidor HTTP.
import { criarApp } from "./http/app";
import { env } from "./config/env";

const app = criarApp();

app.listen(env.PORT, () => {
  console.log(`API da Catraca ouvindo em http://localhost:${env.PORT}`);
});
