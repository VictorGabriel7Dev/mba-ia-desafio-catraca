// Testes de contrato da F1 (C-F1-01 a C-F1-05).
import { describe, expect, it } from "vitest";
import request from "supertest";
import { criarApp } from "../src/http/app";
import { criarChaveParceiro, criarOrganizador } from "./fixtures";

const app = criarApp();

const participante = {
  name: "Diego Participante",
  email: "diego.participante@teste.dev",
  password: "participante123",
};

describe("C-F1-01 cadastro, login, me e logout do participante", () => {
  it("cadastra, faz login, consulta me com papel participant e encerra a sessão", async () => {
    const cadastro = await request(app).post("/api/auth/register").send(participante);
    expect(cadastro.status).toBe(201);
    expect(cadastro.body.user.role).toBe("participant");
    expect(cadastro.body.user.email).toBe(participante.email);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: participante.email, password: participante.password });
    expect(login.status).toBe(200);
    expect(typeof login.body.token).toBe("string");

    const token = login.body.token as string;
    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(login.body.user.id);
    expect(me.body.user.role).toBe("participant");

    const logout = await request(app).post("/api/auth/logout");
    expect(logout.status).toBe(200);
  });

  it("mantém a sessão por cookie httpOnly (fluxo do navegador)", async () => {
    const agente = request.agent(app);
    const cadastro = await agente.post("/api/auth/register").send(participante);
    expect(cadastro.status).toBe(201);

    const me = await agente.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(participante.email);
  });
});

describe("C-F1-02 e-mail duplicado é rejeitado", () => {
  it("recusa o segundo cadastro com o mesmo e-mail", async () => {
    const primeiro = await request(app).post("/api/auth/register").send(participante);
    expect(primeiro.status).toBe(201);

    const segundo = await request(app).post("/api/auth/register").send(participante);
    expect(segundo.status).toBe(409);
    expect(segundo.body.error).toBe("email_in_use");
  });
});

describe("C-F1-03 organizador não se cadastra pelo produto; a seed cria", () => {
  it("recusa register pedindo papel organizer", async () => {
    const resposta = await request(app)
      .post("/api/auth/register")
      .send({ ...participante, role: "organizer" });
    expect(resposta.status).toBe(422);
    expect(resposta.body.error).toBe("invalid_request");
  });

  it("o caminho da seed cria organizador, que faz login com papel organizer", async () => {
    const { user, senha } = await criarOrganizador();
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: senha });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe("organizer");
  });
});

describe("C-F1-04 visitante e participante barrados na área de organizador", () => {
  it("sem sessão responde 401", async () => {
    const resposta = await request(app).get("/api/organizer/events");
    expect(resposta.status).toBe(401);
    expect(resposta.body.error).toBe("unauthorized");
  });

  it("com sessão de participante responde 403", async () => {
    const cadastro = await request(app).post("/api/auth/register").send(participante);
    const token = cadastro.body.token as string;
    const resposta = await request(app)
      .get("/api/organizer/events")
      .set("Authorization", `Bearer ${token}`);
    expect(resposta.status).toBe(403);
    expect(resposta.body.error).toBe("forbidden");
  });

  it("com sessão de organizador passa", async () => {
    const { user, senha } = await criarOrganizador();
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: senha });
    const resposta = await request(app)
      .get("/api/organizer/events")
      .set("Authorization", `Bearer ${login.body.token}`);
    expect(resposta.status).toBe(200);
  });
});

describe("C-F1-05 rota de parceiro exige X-Api-Key válida", () => {
  it("sem chave responde 401 unauthorized", async () => {
    const resposta = await request(app).get("/api/partner/events");
    expect(resposta.status).toBe(401);
    expect(resposta.body.error).toBe("unauthorized");
  });

  it("com chave inválida responde 401 unauthorized", async () => {
    await criarChaveParceiro("chave-valida", true);
    const resposta = await request(app)
      .get("/api/partner/events")
      .set("X-Api-Key", "chave-que-nao-existe");
    expect(resposta.status).toBe(401);
    expect(resposta.body.error).toBe("unauthorized");
  });

  it("com chave inativa responde 401 unauthorized", async () => {
    await criarChaveParceiro("chave-inativa", false);
    const resposta = await request(app)
      .get("/api/partner/events")
      .set("X-Api-Key", "chave-inativa");
    expect(resposta.status).toBe(401);
  });

  it("com a chave ativa da seed passa (200)", async () => {
    const chave = await criarChaveParceiro("chave-da-seed", true);
    const resposta = await request(app).get("/api/partner/events").set("X-Api-Key", chave.key);
    expect(resposta.status).toBe(200);
    expect(Array.isArray(resposta.body)).toBe(true);
  });
});
