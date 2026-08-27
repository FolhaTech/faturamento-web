import { NextResponse } from "next/server";
import { lancarDescontoSaldoFerias } from "@/lib/calc/descontoSaldoFerias";
import { getColaborador, updateSaldosFerias } from "@/lib/repo/colaboradores";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ matricula: string }> }) {
  const { matricula } = await params;
  const body = await request.json();
  const saldoFerias = Number(body?.saldoFerias);
  const saldoUmTerco = Number(body?.saldoUmTerco);

  if (!Number.isFinite(saldoFerias) || !Number.isFinite(saldoUmTerco)) {
    return NextResponse.json({ error: "Saldo inválido." }, { status: 400 });
  }

  const colaboradorAtual = await getColaborador(Number(matricula));
  if (!colaboradorAtual) return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404 });

  try {
    const competenciaAplicada = await lancarDescontoSaldoFerias(colaboradorAtual, saldoFerias, saldoUmTerco);

    // Lançou como desconto: o campo zera sozinho. Sem competência pra lançar ainda: só guarda o
    // valor digitado (fica pendente até o primeiro upload de Movimentos existir).
    const colaborador = competenciaAplicada
      ? await updateSaldosFerias(Number(matricula), 0, 0)
      : await updateSaldosFerias(Number(matricula), saldoFerias, saldoUmTerco);

    return NextResponse.json({ colaborador, competenciaAplicada });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao salvar.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
