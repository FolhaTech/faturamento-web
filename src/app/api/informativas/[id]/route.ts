import { NextResponse } from "next/server";
import { deleteInformativa, updateInformativa } from "@/lib/repo/informativas";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { codigo, evento, valor, recorrencia, inicio, obs } = body ?? {};

  if (typeof evento !== "string" || !evento.trim()) return NextResponse.json({ error: "Informe o evento." }, { status: 400 });

  try {
    const informativa = await updateInformativa(id, {
      codigo: Number.isFinite(codigo) && codigo > 0 ? codigo : null,
      evento: evento.trim(),
      valor: Number(valor) || 0,
      recorrencia: recorrencia || null,
      inicio: inicio || null,
      obs: obs || null,
    });
    return NextResponse.json({ informativa });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao atualizar.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteInformativa(id);
  return NextResponse.json({ ok: true });
}
