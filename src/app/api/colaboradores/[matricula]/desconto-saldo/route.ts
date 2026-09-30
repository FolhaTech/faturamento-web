import { NextResponse } from "next/server";
import { deleteDescontoSaldoPorCompetencia, setDescontoSaldo } from "@/lib/repo/descontosSaldo";
import type { TipoSaldoFerias } from "@/lib/types";

export const runtime = "nodejs";

interface BodyPut {
  competencia?: string;
  ferias?: number;
  terco?: number;
}

function parseValor(n: unknown): number {
  const v = typeof n === "string" ? Number(n.replace(",", ".")) : Number(n);
  return Number.isFinite(v) ? v : NaN;
}

export async function PUT(request: Request, { params }: { params: Promise<{ matricula: string }> }) {
  const { matricula } = await params;
  const body = (await request.json().catch(() => ({}))) as BodyPut;
  const competencia = typeof body.competencia === "string" ? body.competencia.trim() : "";
  const ferias = parseValor(body.ferias);
  const terco = parseValor(body.terco);

  if (competencia === "") {
    return NextResponse.json({ error: "Competência inválida." }, { status: 400 });
  }
  if (!Number.isFinite(ferias) || ferias < 0 || !Number.isFinite(terco) || terco < 0) {
    return NextResponse.json({ error: "Valores inválidos." }, { status: 400 });
  }

  try {
    await setDescontoSaldo(Number(matricula), competencia, "ferias" as TipoSaldoFerias, ferias);
    await setDescontoSaldo(Number(matricula), competencia, "terco" as TipoSaldoFerias, terco);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao salvar.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ matricula: string }> }) {
  const { matricula } = await params;
  const body = (await request.json().catch(() => ({}))) as { competencia?: string };
  const competencia = typeof body.competencia === "string" ? body.competencia.trim() : "";

  if (competencia === "") {
    return NextResponse.json({ error: "Competência inválida." }, { status: 400 });
  }

  try {
    await deleteDescontoSaldoPorCompetencia(Number(matricula), competencia);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao excluir.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
