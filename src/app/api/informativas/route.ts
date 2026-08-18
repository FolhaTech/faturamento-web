import { NextResponse } from "next/server";
import { createInformativa, listInformativas } from "@/lib/repo/informativas";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ informativas: await listInformativas() });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { codigo, evento, valor, recorrencia, inicio, obs } = body ?? {};

  if (typeof evento !== "string" || !evento.trim()) return NextResponse.json({ error: "Informe o evento." }, { status: 400 });

  const informativa = await createInformativa({
    codigo: Number.isFinite(codigo) && codigo > 0 ? codigo : null,
    evento: evento.trim(),
    valor: Number(valor) || 0,
    recorrencia: recorrencia || null,
    inicio: inicio || null,
    obs: obs || null,
  });
  return NextResponse.json({ informativa }, { status: 201 });
}
