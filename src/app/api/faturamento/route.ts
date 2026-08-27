import { NextResponse } from "next/server";
import { aggregateByCcusto } from "@/lib/calc/aggregate";
import { runEngine } from "@/lib/calc/engine";
import { listMovimentosByCompetencia } from "@/lib/repo/movimentos";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const competencia = url.searchParams.get("competencia");
  if (!competencia) {
    return NextResponse.json({ error: "Informe a competência (?competencia=MM/AAAA)." }, { status: 400 });
  }

  const movimentos = await listMovimentosByCompetencia(competencia);
  if (movimentos.length === 0) {
    return NextResponse.json({ error: `Nenhum lançamento encontrado para a competência ${competencia}.` }, { status: 404 });
  }

  const { lines, warnings } = await runEngine(movimentos);
  const resumos = aggregateByCcusto(lines, competencia);

  return NextResponse.json({ competencia, resumos, warnings });
}
