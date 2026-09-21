import { NextResponse } from "next/server";
import { dominioPermitidoParaCadastro } from "@/lib/auth/dominios";
import { COOKIE_SESSAO } from "@/lib/auth/sessao";
import { criarSessao, criarUsuario, usuarioExiste } from "@/lib/repo/usuarios";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const nome = typeof body?.nome === "string" ? body.nome.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const senha = typeof body?.senha === "string" ? body.senha : "";

  if (!nome || !email || !senha) {
    return NextResponse.json({ error: "Preencha nome, e-mail e senha." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }
  if (senha.length < 8) {
    return NextResponse.json({ error: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
  }
  if (!dominioPermitidoParaCadastro(email)) {
    return NextResponse.json({ error: "Cadastro liberado só para e-mails @Genter, @ArantesArimura ou @FolhaTech." }, { status: 403 });
  }
  if (await usuarioExiste(email)) {
    return NextResponse.json({ error: "Já existe uma conta com esse e-mail." }, { status: 409 });
  }

  const usuario = await criarUsuario(nome, email, senha);
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
