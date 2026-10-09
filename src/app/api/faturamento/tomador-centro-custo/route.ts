import { NextResponse } from "next/server";
import { updateTomadorEmLote } from "@/lib/repo/colaboradores";
import { getTomador } from "@/lib/repo/tomadores";

export const runtime = "nodejs";

/** Trava de segurança: um centro de custo não passa disso — evita um corpo gigante trocar a base inteira por engano. */
const MAX_COLABORADORES = 1000;

/**
 * Troca o Tomador de todos os colaboradores de um centro de custo do Faturamento de uma vez (seletor "Tomador do
 * centro de custo", ver TomadorCentroCusto.tsx). Recebe as matrículas exatas mostradas na tela — nunca o nome do
 * centro de custo — pra um centro genérico como "GERAL" não ser trocado em bloco por engano.
 */
export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const codServico = Number(body?.codServico);
  const matriculas: unknown = body?.matriculas;

  if (!Number.isInteger(codServico)) return NextResponse.json({ error: "Informe codServico (número do Tomador)." }, { status: 400 });
  if (!Array.isArray(matriculas) || matriculas.length === 0 || !matriculas.every((m) => Number.isInteger(m))) {
    return NextResponse.json({ error: "Informe matriculas (lista de números)." }, { status: 400 });
  }
  if (matriculas.length > MAX_COLABORADORES) {
    return NextResponse.json({ error: `Muitos colaboradores de uma vez (máximo ${MAX_COLABORADORES}).` }, { status: 400 });
  }

  const tomador = await getTomador(codServico);
  if (!tomador) return NextResponse.json({ error: `Tomador ${codServico} não encontrado.` }, { status: 404 });

  try {
    const atualizados = await updateTomadorEmLote(matriculas as number[], { codigo: tomador.codigo, nome: tomador.nome });
    return NextResponse.json({ atualizados });
  } catch (err) {
    console.error("[faturamento/tomador-centro-custo] erro:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Falha ao salvar." }, { status: 500 });
  }
}
