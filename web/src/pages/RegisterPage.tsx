// Cadastro do participante.
import { useState, type FormEvent, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { useSessao } from "../lib/auth";
import { ErroApi } from "../lib/api";

export function RegisterPage(): ReactElement {
  const { fazerCadastro } = useSessao();
  const navegar = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: FormEvent): Promise<void> {
    evento.preventDefault();
    setErro(null);
    try {
      await fazerCadastro(name, email, password);
      navegar("/");
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === "email_in_use") {
        setErro("Este e-mail já está cadastrado.");
      } else if (e instanceof ErroApi && e.codigo === "invalid_request") {
        setErro("Verifique os dados: senha com ao menos 8 caracteres e e-mail válido.");
      } else {
        setErro("Não foi possível cadastrar.");
      }
    }
  }

  return (
    <section>
      <h2>Cadastro de participante</h2>
      <form onSubmit={enviar} style={{ display: "grid", gap: "0.5rem", maxWidth: 320 }}>
        <input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Cadastrar</button>
      </form>
      {erro && <p style={{ color: "crimson" }}>{erro}</p>}
    </section>
  );
}
