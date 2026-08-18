import { NextResponse } from "next/server";
import { listTomadores, upsertTomador } from "@/lib/repo/tomadores";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ tomadores: await listTomadores() });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { codigo, nome, fpas, taxaAdm } = body ?? {};

  if (!Number.isFinite(codigo) || codigo <= 0) return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  if (typeof nome !== "string" || !nome.trim()) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
  if (fpas !== 515 && fpas !== 655) return NextResponse.json({ error: "FPAS deve ser 515 ou 655." }, { status: 400 });
  if (!Number.isFinite(taxaAdm) || taxaAdm < 0) return NextResponse.json({ error: "Taxa administrativa inválida." }, { status: 400 });

  const tomador = await upsertTomador({ codigo, nome: nome.trim(), fpas, taxaAdm });
  return NextResponse.json({ tomador }, { status: 201 });
}
