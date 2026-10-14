import { NextResponse } from "next/server";
import { definirDescontoProvisao } from "@/lib/calc/descontoProvisaoAcumulada";
import { getColaborador } from "@/lib/repo/colaboradores";
import { definirAvisoPrevioAplicado } from "@/lib/repo/descontosSaldo";

export const runtime = "nodejs";

/** "ferias" = Prov. Férias, "13" = Prov. 13º (vira o tipo "terco" em descontos_saldo, igual ao resto do sistema). */
const TIPOS = { ferias: "ferias", "13": "terco" } as const;

/**
 * Sim/Não por colaborador no Faturamento. Prov. Férias ("ferias") e Prov. 13º ("13") lançam/tiram o desconto calculado da provisão
 * acumulada; "aviso" liga/desliga a cobrança do desconto de aviso prévio já lançado (valor digitado na tela do colaborador) — "Não"
 * só tira da fatura e guarda o valor, "Sim" volta a cobrá-lo.
 */
export async function PUT(request: Request) {
  const body = (await request.json()) as { matricula?: unknown; competencia?: unknown; tipo?: unknown; aplicar?: unknown };
  const matricula = Number(body.matricula);
  const competencia = typeof body.competencia === "string" ? body.competencia.trim() : "";
  const avisoPrevio = body.tipo === "aviso";
  const tipo = typeof body.tipo === "string" && body.tipo in TIPOS ? TIPOS[body.tipo as keyof typeof TIPOS] : null;

  if (!Number.isInteger(matricula) || competencia === "" || (!tipo && !avisoPrevio) || typeof body.aplicar !== "boolean") {
    return NextResponse.json({ error: "Informe matricula, competencia, tipo (ferias|13|aviso) e aplicar (true|false)." }, { status: 400 });
  }
  if (!(await getColaborador(matricula))) {
    return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404 });
  }

  try {
    if (avisoPrevio) {
      const valor = await definirAvisoPrevioAplicado(matricula, competencia, body.aplicar);
      return NextResponse.json({ valor });
    }
    const valor = await definirDescontoProvisao(matricula, competencia, tipo!, body.aplicar);
    return NextResponse.json({ valor });
  } catch (error) {
    console.error("[faturamento/desconto-provisao] erro:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao salvar." }, { status: 500 });
  }
}
