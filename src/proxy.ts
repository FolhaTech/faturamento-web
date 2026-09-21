import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_SESSAO } from "@/lib/auth/sessao";
import { getUsuarioPorSessao } from "@/lib/repo/usuarios";

/** Rotas acessíveis sem estar logado. */
const ROTAS_PUBLICAS = ["/login", "/cadastro", "/api/auth/login", "/api/auth/cadastro", "/api/auth/logout"];

/**
 * Roda em runtime Node.js por padrão nesta versão do Next (ver
 * node_modules/next/dist/docs/.../file-conventions/proxy.md — "middleware" foi renomeado pra
 * "proxy" e passou a rodar em Node.js, não Edge) — por isso dá pra consultar o Postgres direto
 * aqui, sem precisar de JWT/segredo de sessão: o token do cookie é validado contra a tabela
 * sessoes a cada requisição (ver repo/usuarios.ts).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rotaPublica = ROTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  const token = request.cookies.get(COOKIE_SESSAO)?.value;
  const usuario = token ? await getUsuarioPorSessao(token) : null;

  if (!usuario && !rotaPublica) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  if (usuario && (pathname === "/login" || pathname === "/cadastro")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
