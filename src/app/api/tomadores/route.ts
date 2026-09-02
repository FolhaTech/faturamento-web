import { NextResponse } from "next/server";
import { listTomadores, upsertTomador } from "@/lib/repo/tomadores";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ tomadores: await listTomadores() });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { codigo, nome, fpas, taxaAdm, grossUp } = body ?? {};

  if (!Number.isFinite(codigo) || codigo <= 0) return NextResponse.json({ error: "Código inválido." }, { status: 400 });
  if (typeof nome !== "string" || !nome.trim()) return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
  if (fpas !== 515 && fpas !== 655) return NextResponse.json({ error: "FPAS deve ser 515 ou 655." }, { status: 400 });
  if (!Number.isFinite(taxaAdm) || taxaAdm < 0) return NextResponse.json({ error: "Taxa administrativa inválida." }, { status: 400 });
  if (grossUp !== undefined && (!Number.isFinite(grossUp) || grossUp < 0 || grossUp > 1)) {
    return NextResponse.json(
      { error: "Gross Up inválido — deve ser entre 0 e 1 (Terceiro: ~0,8675; Temporário: ~0,1325). 0 desliga o gross-up: NF = fatura." },
      { status: 400 },
    );
  }

  const tomador = await upsertTomador({ codigo, nome: nome.trim(), fpas, taxaAdm, grossUp });
  return NextResponse.json({ tomador }, { status: 201 });
}
