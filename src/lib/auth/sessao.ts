import { cookies } from "next/headers";
import { getUsuarioPorSessao, type Usuario } from "../repo/usuarios";

/** Nome do cookie de sessão — mesmo nome usado em proxy.ts, nas rotas de auth e aqui. */
export const COOKIE_SESSAO = "sessao_token";

/** Usuário logado (via cookie httpOnly + tabela sessoes), ou null se não estiver logado / sessão expirada. Uso em Server Components e Route Handlers. */
export async function getUsuarioAtual(): Promise<Usuario | null> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  return getUsuarioPorSessao(token);
}
