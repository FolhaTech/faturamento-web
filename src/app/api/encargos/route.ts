import { NextResponse } from "next/server";
import { listEncargos, upsertEncargo } from "@/lib/repo/encargos";
import type { TipoEvento } from "@/lib/types";

export const runtime = "nodejs";

const TIPOS: TipoEvento[] = ["P", "D", "I", "R", "FGTS", "INSS"];

export async function GET() {
  return NextResponse.json({ encargos: listEncargos() });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { codigo, evento, tipo, inss655, inss515, fgts, provFerias, prov13 } = body ?? {};

  if (!Number.isFinite(codigo) || codigo <= 0) return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  if (typeof evento !== "string" || !evento.trim()) return NextResponse.json({ error: "Informe o evento." }, { status: 400 });
  if (!TIPOS.includes(tipo)) return NextResponse.json({ error: `Tipo deve ser um de: ${TIPOS.join(", ")}.` }, { status: 400 });

  const encargo = upsertEncargo({
    codigo,
    evento: evento.trim(),
    tipo,
    inss655: Number(inss655) || 0,
    inss515: Number(inss515) || 0,
    fgts: Number(fgts) || 0,
    provFerias: Number(provFerias) || 0,
    prov13: Number(prov13) || 0,
  });
  return NextResponse.json({ encargo }, { status: 201 });
}
