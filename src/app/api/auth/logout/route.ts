import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_SESSAO } from "@/lib/auth/sessao";
import { destruirSessao } from "@/lib/repo/usuarios";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_SESSAO)?.value;
  if (token) await destruirSessao(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_SESSAO);
  return res;
}
