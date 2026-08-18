import { NextResponse } from "next/server";
import { deleteTomador, upsertTomador } from "@/lib/repo/tomadores";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const body = await request.json();
  const { nome, fpas, taxaAdm } = body ?? {};

  if (typeof nome !== "string" || !nome.trim()) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
  if (fpas !== 515 && fpas !== 655) return NextResponse.json({ error: "FPAS deve ser 515 ou 655." }, { status: 400 });
  if (!Number.isFinite(taxaAdm) || taxaAdm < 0) return NextResponse.json({ error: "Taxa administrativa inválida." }, { status: 400 });

  const tomador = await upsertTomador({ codigo: Number(codigo), nome: nome.trim(), fpas, taxaAdm });
  return NextResponse.json({ tomador });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  await deleteTomador(Number(codigo));
  return NextResponse.json({ ok: true });
}
