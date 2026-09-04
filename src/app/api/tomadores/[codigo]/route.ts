import { NextResponse } from "next/server";
import { deleteTomador, upsertTomador } from "@/lib/repo/tomadores";
import type { GrossUpOperacao } from "@/lib/types";

export const runtime = "nodejs";

const OPERACOES: GrossUpOperacao[] = ["+", "-", "*", "/"];

export async function PUT(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const body = await request.json();
  const { nome, fpas, taxaAdm, grossUp, grossUpOperacao } = body ?? {};

  if (typeof nome !== "string" || !nome.trim()) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
  if (fpas !== 515 && fpas !== 655) return NextResponse.json({ error: "FPAS deve ser 515 ou 655." }, { status: 400 });
  if (!Number.isFinite(taxaAdm) || taxaAdm < 0) return NextResponse.json({ error: "Taxa administrativa inválida." }, { status: 400 });
  if (grossUp !== undefined && (!Number.isFinite(grossUp) || grossUp < 0 || grossUp > 1)) {
    return NextResponse.json(
      { error: "Gross Up inválido — deve ser entre 0 e 1 (padrão ~0,1325). 0 desliga o gross-up: NF = fatura." },
      { status: 400 },
    );
  }
  if (grossUpOperacao !== undefined && !OPERACOES.includes(grossUpOperacao)) {
    return NextResponse.json({ error: `Operador inválido — deve ser um de: ${OPERACOES.join(" ")}.` }, { status: 400 });
  }

  const tomador = await upsertTomador({ codigo: Number(codigo), nome: nome.trim(), fpas, taxaAdm, grossUp, grossUpOperacao });
  return NextResponse.json({ tomador });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  await deleteTomador(Number(codigo));
  return NextResponse.json({ ok: true });
}
