import { NextResponse } from "next/server";
import { updateGrossUp } from "@/lib/repo/tomadores";
import type { GrossUpOperacao } from "@/lib/types";

export const runtime = "nodejs";

const OPERACOES: GrossUpOperacao[] = ["+", "-", "*", "/"];

/** Atualização rápida só do Gross Up (valor + operador) — usada pelo formulário na tela de Faturamento, que não tem nome/FPAS/Taxa Adm à mão pra fazer um PUT completo em /api/tomadores/[codigo]. */
export async function PUT(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const body = await request.json();
  const { grossUp, grossUpOperacao } = body ?? {};

  if (!Number.isFinite(grossUp) || grossUp < 0 || grossUp > 1) {
    return NextResponse.json(
      { error: "Gross Up inválido — deve ser entre 0 e 1 (padrão ~0,1325). 0 desliga o gross-up: NF = fatura." },
      { status: 400 },
    );
  }
  if (!OPERACOES.includes(grossUpOperacao)) {
    return NextResponse.json({ error: `Operador inválido — deve ser um de: ${OPERACOES.join(" ")}.` }, { status: 400 });
  }

  const tomador = await updateGrossUp(Number(codigo), grossUp, grossUpOperacao);
  return NextResponse.json({ tomador });
}
