import { NextResponse } from "next/server";
import { deleteEncargo, upsertEncargo } from "@/lib/repo/encargos";
import type { TipoEvento } from "@/lib/types";

export const runtime = "nodejs";

const TIPOS: TipoEvento[] = ["P", "D", "I", "R", "FGTS", "INSS"];

export async function PUT(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const body = await request.json();
  const { evento, tipo, inss655, inss515, fgts, provFerias, prov13, abateSaldoFerias } = body ?? {};

  if (typeof evento !== "string" || !evento.trim()) return NextResponse.json({ error: "Informe o evento." }, { status: 400 });
  if (!TIPOS.includes(tipo)) return NextResponse.json({ error: `Tipo deve ser um de: ${TIPOS.join(", ")}.` }, { status: 400 });

  const encargo = await upsertEncargo({
    codigo: Number(codigo),
    evento: evento.trim(),
    tipo,
    inss655: Number(inss655) || 0,
    inss515: Number(inss515) || 0,
    fgts: Number(fgts) || 0,
    provFerias: Number(provFerias) || 0,
    prov13: Number(prov13) || 0,
    abateSaldoFerias: Boolean(abateSaldoFerias),
  });
  return NextResponse.json({ encargo });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  await deleteEncargo(Number(codigo));
  return NextResponse.json({ ok: true });
}
