import { NextResponse } from "next/server";
import { lancarDescontoSaldoFerias } from "@/lib/calc/descontoSaldoFerias";
import { getColaborador, updateSaldosFerias } from "@/lib/repo/colaboradores";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ matricula: string }> }) {
  const { matricula } = await params;
  const body = await request.json();
  const saldoFerias = Number(body?.saldoFerias);
  const saldoUmTerco = Number(body?.saldoUmTerco);
  // Competência escolhida na tela (ver seletor em page.tsx) — pra qual o valor digitado vai ser
  // lançado. null quando ainda não há nenhuma competência com Movimentos enviados.
  const competencia = typeof body?.competencia === "string" && body.competencia.trim() !== "" ? body.competencia : null;

  if (!Number.isFinite(saldoFerias) || !Number.isFinite(saldoUmTerco)) {
    return NextResponse.json({ error: "Saldo inválido." }, { status: 400 });
  }

  const colaboradorAtual = await getColaborador(Number(matricula));
  if (!colaboradorAtual) return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404 });

  try {
    const podeLancar = competencia !== null && (saldoFerias > 0 || saldoUmTerco > 0);
    if (podeLancar) {
      await lancarDescontoSaldoFerias(colaboradorAtual, competencia, saldoFerias, saldoUmTerco);
    }

    // Lançou como desconto: o campo zera sozinho. Sem competência escolhida (ou nada a lançar):
    // só guarda o valor digitado, fica pendente até escolher uma competência e salvar de novo.
    const colaborador = podeLancar
      ? await updateSaldosFerias(Number(matricula), 0, 0)
      : await updateSaldosFerias(Number(matricula), saldoFerias, saldoUmTerco);

    return NextResponse.json({ colaborador, competenciaAplicada: podeLancar ? competencia : null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao salvar.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
