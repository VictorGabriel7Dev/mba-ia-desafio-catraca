// Regras puras de usuário: papéis, e-mail e política de senha.
// Camada de domínio: não importa infraestrutura (sem Prisma, sem Express, sem env).

export type Papel = "participant" | "organizer";

export const SENHA_MINIMA = 8;

// Validação simples e suficiente para o escopo: um "@" com partes não vazias.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailValido(email: string): boolean {
  return EMAIL_REGEX.test(normalizarEmail(email));
}

export function senhaValida(senha: string): boolean {
  return typeof senha === "string" && senha.length >= SENHA_MINIMA;
}

export function nomeValido(nome: string): boolean {
  return typeof nome === "string" && nome.trim().length >= 1;
}

// O produto só cria participantes. Organizadores vêm exclusivamente da seed.
// Esta função existe para deixar a regra explícita e testável.
export function papelPermitidoNoCadastro(): Papel {
  return "participant";
}
