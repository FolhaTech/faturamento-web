import { NextResponse } from "next/server";
import { runEngine } from "@/lib/calc/engine";
import { descartarFaturaSalva, salvarFatura } from "@/lib/repo/faturasSalvas";
import { listMovimentosByCompetencia } from "@/lib/repo/movimentos";

export const runtime = "nodejs";

/** Congela o cálculo ao vivo da competência (ver faturasSalvas.ts) — a tela de Faturamento passa a mostrar essa foto em vez de recalcular. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const competencia = typeof body?.competencia === "string" ? body.competencia : null;
  if (!competencia) {
    return NextResponse.json({ error: "Informe a competência." }, { status: 400 });
  }

  const movimentos = await listMovimentosByCompetencia(competencia);
  if (movimentos.length === 0) {
    return NextResponse.json({ error: `Nenhum lançamento encontrado para a competência ${competencia}.` }, { status: 404 });
  }

  const { lines, warnings } = await runEngine(movimentos);
  const fatura = await salvarFatura(competencia, lines, warnings);

  return NextResponse.json({ salvoEm: fatura.salvoEm });
}

/** Descarta a foto salva — a tela volta a mostrar o cálculo ao vivo dessa competência. */
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const competencia = url.searchParams.get("competencia");
  if (!competencia) {
    return NextResponse.json({ error: "Informe a competência." }, { status: 400 });
  }

  await descartarFaturaSalva(competencia);
  return NextResponse.json({ ok: true });
}
