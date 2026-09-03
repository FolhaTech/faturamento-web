import { NextResponse } from "next/server";
import { updateGrossUp } from "@/lib/repo/tomadores";

export const runtime = "nodejs";

/** Atualização rápida só do Gross Up — usada pelo formulário na tela de Faturamento, que não tem nome/FPAS/Taxa Adm à mão pra fazer um PUT completo em /api/tomadores/[codigo]. */
export async function PUT(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const body = await request.json();
  const { grossUp } = body ?? {};

  if (!Number.isFinite(grossUp) || grossUp < 0 || grossUp > 1) {
    return NextResponse.json(
      { error: "Gross Up inválido — deve ser entre 0 e 1 (padrão ~0,8675; exceção Tomador código 14/ITAU ~0,1325). 0 desliga o gross-up: NF = fatura." },
      { status: 400 },
    );
  }

  const tomador = await updateGrossUp(Number(codigo), grossUp);
  return NextResponse.json({ tomador });
}
