// Estado de sessão do front: carrega o usuário via /me e expõe login/logout.
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { entrar, meuUsuario, registrar, sair, type Usuario } from "./api";

interface Sessao {
  usuario: Usuario | null;
  carregando: boolean;
  fazerLogin: (email: string, password: string) => Promise<void>;
  fazerCadastro: (name: string, email: string, password: string) => Promise<void>;
  fazerLogout: () => Promise<void>;
}

const Contexto = createContext<Sessao | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    meuUsuario()
      .then((r) => setUsuario(r.user))
      .catch(() => setUsuario(null))
      .finally(() => setCarregando(false));
  }, []);

  async function fazerLogin(email: string, password: string): Promise<void> {
    const r = await entrar({ email, password });
    setUsuario(r.user);
  }

  async function fazerCadastro(name: string, email: string, password: string): Promise<void> {
    const r = await registrar({ name, email, password });
    setUsuario(r.user);
  }

  async function fazerLogout(): Promise<void> {
    await sair();
    setUsuario(null);
  }

  return (
    <Contexto.Provider value={{ usuario, carregando, fazerLogin, fazerCadastro, fazerLogout }}>
      {children}
    </Contexto.Provider>
  );
}

export function useSessao(): Sessao {
  const ctx = useContext(Contexto);
  if (!ctx) {
    throw new Error("useSessao precisa estar dentro de ProvedorSessao.");
  }
  return ctx;
}
