import { NextResponse } from "next/server";
import { CHAVE_PLR_CELETISTA, getConfigNumero, setConfigNumero } from "@/lib/repo/configuracoes";

export const runtime = "nodejs";

export async function GET() {
  const valor = await getConfigNumero(CHAVE_PLR_CELETISTA, 29.32);
  return NextResponse.json({ valor });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const valor = Number(body?.valor);
  if (!Number.isFinite(valor) || valor < 0) {
    return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
  }
  await setConfigNumero(CHAVE_PLR_CELETISTA, valor);
  return NextResponse.json({ valor });
}
