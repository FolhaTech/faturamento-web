import { NextResponse } from "next/server";
import { COOKIE_SESSAO } from "@/lib/auth/sessao";
import { criarSessao, verificarCredenciais } from "@/lib/repo/usuarios";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const senha = typeof body?.senha === "string" ? body.senha : "";

  if (!email || !senha) {
    return NextResponse.json({ error: "Preencha e-mail e senha." }, { status: 400 });
  }

  const usuario = await verificarCredenciais(email, senha);
  if (!usuario) {
    return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  }

  const { token, expiraEm } = await criarSessao(usuario.email);

  const res = NextResponse.json({ usuario });
  res.cookies.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiraEm,
  });
  return res;
}
