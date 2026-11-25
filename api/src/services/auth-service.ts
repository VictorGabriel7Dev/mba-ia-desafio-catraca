// Regras de conta e sessão. Orquestra domínio e repositórios; nunca toca no Prisma
// nem no Express diretamente. Nunca cria organizador (esses vêm só da seed).
import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import {
  emailValido,
  nomeValido,
  normalizarEmail,
  papelPermitidoNoCadastro,
  senhaValida,
} from "../domain/usuario";
import { ErroAplicacao } from "../lib/errors";
import { assinarSessao } from "../lib/token";
import * as usuarios from "../repositories/user-repository";

const CUSTO_BCRYPT = 10;

export interface UsuarioPublico {
  id: string;
  name: string;
  email: string;
  role: "participant" | "organizer";
  createdAt: string;
}

export interface EntradaCadastro {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  role?: unknown;
}

export interface EntradaLogin {
  email?: unknown;
  password?: unknown;
}

export function paraPublico(usuario: User): UsuarioPublico {
  return {
    id: usuario.id,
    name: usuario.name,
    email: usuario.email,
    role: usuario.role,
    createdAt: usuario.createdAt.toISOString(),
  };
}

// Cadastro de participante. O papel é sempre "participant": qualquer tentativa de
// pedir "organizer" (ou outro valor) pelo produto é recusada (R13 / CF1.2).
export async function registrarParticipante(
  entrada: EntradaCadastro,
): Promise<{ usuario: UsuarioPublico; token: string }> {
  const { name, email, password, role } = entrada;

  if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
    throw new ErroAplicacao("invalid_request", 422, "Campos obrigatórios ausentes.");
  }
  if (role !== undefined && role !== "participant") {
    throw new ErroAplicacao(
      "invalid_request",
      422,
      "Não é possível cadastrar organizador pelo produto.",
    );
  }
  if (!nomeValido(name)) {
    throw new ErroAplicacao("invalid_request", 422, "Nome inválido.");
  }
  if (!emailValido(email)) {
    throw new ErroAplicacao("invalid_request", 422, "E-mail inválido.");
  }
  if (!senhaValida(password)) {
    throw new ErroAplicacao("invalid_request", 422, "Senha muito curta.");
  }

  const emailNormalizado = normalizarEmail(email);
  const existente = await usuarios.buscarPorEmail(emailNormalizado);
  if (existente) {
    throw new ErroAplicacao("email_in_use", 409, "E-mail já cadastrado.");
  }

  const passwordHash = await bcrypt.hash(password, CUSTO_BCRYPT);
  const usuario = await usuarios.criar({
    name: name.trim(),
    email: emailNormalizado,
    passwordHash,
    role: papelPermitidoNoCadastro(),
  });

  return { usuario: paraPublico(usuario), token: assinarSessao({ sub: usuario.id, role: usuario.role }) };
}

export async function login(
  entrada: EntradaLogin,
): Promise<{ usuario: UsuarioPublico; token: string }> {
  const { email, password } = entrada;
  if (typeof email !== "string" || typeof password !== "string") {
    throw new ErroAplicacao("invalid_request", 422, "Credenciais ausentes.");
  }

  const usuario = await usuarios.buscarPorEmail(normalizarEmail(email));
  // Mesma resposta para e-mail inexistente e senha errada (não vaza existência).
  const hash = usuario?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
  const confere = await bcrypt.compare(password, hash);
  if (!usuario || !confere) {
    throw new ErroAplicacao("invalid_credentials", 401, "E-mail ou senha inválidos.");
  }

  return { usuario: paraPublico(usuario), token: assinarSessao({ sub: usuario.id, role: usuario.role }) };
}

// Retorna a identidade a partir do id da sessão já validada.
export async function me(userId: string): Promise<UsuarioPublico> {
  const usuario = await usuarios.buscarPorId(userId);
  if (!usuario) {
    throw new ErroAplicacao("unauthorized", 401, "Sessão inválida.");
  }
  return paraPublico(usuario);
}
