import { NextResponse } from "next/server";
import { definirDescontoProvisao } from "@/lib/calc/descontoProvisaoAcumulada";
import { getColaborador } from "@/lib/repo/colaboradores";

export const runtime = "nodejs";

/** "ferias" = Prov. Férias, "13" = Prov. 13º (vira o tipo "terco" em descontos_saldo, igual ao resto do sistema). */
const TIPOS = { ferias: "ferias", "13": "terco" } as const;

export async function PUT(request: Request) {
  const body = (await request.json()) as { matricula?: unknown; competencia?: unknown; tipo?: unknown; aplicar?: unknown };
  const matricula = Number(body.matricula);
  const competencia = typeof body.competencia === "string" ? body.competencia.trim() : "";
  const tipo = typeof body.tipo === "string" && body.tipo in TIPOS ? TIPOS[body.tipo as keyof typeof TIPOS] : null;

  if (!Number.isInteger(matricula) || competencia === "" || !tipo || typeof body.aplicar !== "boolean") {
    return NextResponse.json({ error: "Informe matricula, competencia, tipo (ferias|13) e aplicar (true|false)." }, { status: 400 });
  }
  if (!(await getColaborador(matricula))) {
    return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404 });
  }

  try {
    const valor = await definirDescontoProvisao(matricula, competencia, tipo, body.aplicar);
    return NextResponse.json({ valor });
  } catch (error) {
    console.error("[faturamento/desconto-provisao] erro:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao salvar." }, { status: 500 });
  }
}
