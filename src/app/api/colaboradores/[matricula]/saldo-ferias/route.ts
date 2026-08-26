import { NextResponse } from "next/server";
import { updateSaldosFerias } from "@/lib/repo/colaboradores";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ matricula: string }> }) {
  const { matricula } = await params;
  const body = await request.json();
  const saldoFerias = Number(body?.saldoFerias);
  const saldoUmTerco = Number(body?.saldoUmTerco);

  if (!Number.isFinite(saldoFerias) || !Number.isFinite(saldoUmTerco)) {
    return NextResponse.json({ error: "Saldo inválido." }, { status: 400 });
  }

  try {
    const colaborador = await updateSaldosFerias(Number(matricula), saldoFerias, saldoUmTerco);
    return NextResponse.json({ colaborador });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao salvar.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
