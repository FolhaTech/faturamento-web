import { NextResponse } from "next/server";
import { listEncargos, upsertEncargo } from "@/lib/repo/encargos";
import type { TipoEvento, TipoSaldoFerias } from "@/lib/types";

export const runtime = "nodejs";

const TIPOS: TipoEvento[] = ["P", "D", "I", "R", "FGTS", "INSS"];
const TIPOS_SALDO: TipoSaldoFerias[] = ["ferias", "terco"];

function normalizaAbateSaldo(v: unknown): TipoSaldoFerias | null {
  return TIPOS_SALDO.includes(v as TipoSaldoFerias) ? (v as TipoSaldoFerias) : null;
}

export async function GET() {
  return NextResponse.json({ encargos: await listEncargos() });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { codigo, evento, tipo, inss655, inss515, fgts, provFerias, prov13, abateSaldo } = body ?? {};

  if (!Number.isFinite(codigo) || codigo <= 0) return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  if (typeof evento !== "string" || !evento.trim()) return NextResponse.json({ error: "Informe o evento." }, { status: 400 });
  if (!TIPOS.includes(tipo)) return NextResponse.json({ error: `Tipo deve ser um de: ${TIPOS.join(", ")}.` }, { status: 400 });

  const encargo = await upsertEncargo({
    codigo,
    evento: evento.trim(),
    tipo,
    inss655: Number(inss655) || 0,
    inss515: Number(inss515) || 0,
    fgts: Number(fgts) || 0,
    provFerias: Number(provFerias) || 0,
    prov13: Number(prov13) || 0,
    abateSaldo: normalizaAbateSaldo(abateSaldo),
  });
  return NextResponse.json({ encargo }, { status: 201 });
}
