// Login de participante ou organizador.
import { useState, type FormEvent, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { useSessao } from "../lib/auth";
import { ErroApi } from "../lib/api";

export function LoginPage(): ReactElement {
  const { fazerLogin } = useSessao();
  const navegar = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: FormEvent): Promise<void> {
    evento.preventDefault();
    setErro(null);
    try {
      await fazerLogin(email, password);
      navegar("/");
    } catch (e) {
      if (e instanceof ErroApi && e.codigo === "invalid_credentials") {
        setErro("E-mail ou senha inválidos.");
      } else {
        setErro("Não foi possível entrar.");
      }
    }
  }

  return (
    <section>
      <h2>Entrar</h2>
      <form onSubmit={enviar} style={{ display: "grid", gap: "0.5rem", maxWidth: 320 }}>
        <input placeholder="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Entrar</button>
      </form>
      {erro && <p style={{ color: "crimson" }}>{erro}</p>}
    </section>
  );
}
