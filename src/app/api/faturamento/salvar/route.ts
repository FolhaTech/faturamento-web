import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/lib/auth/sessao";
import { calcularLinesAoVivo, calcularPreviaTotalFaturaPorCcusto } from "@/lib/calc/faturaCompetencia";
import { descartarFaturaSalva, salvarFatura } from "@/lib/repo/faturasSalvas";
import { listMovimentosByCompetencia } from "@/lib/repo/movimentos";

export const runtime = "nodejs";

/**
 * Congela o cálculo ao vivo da competência pro usuário logado (ver faturasSalvas.ts) — vira uma
 * entrada nova na timeline dessa competência, atribuída a ele; não mexe na versão de outro
 * usuário que já tenha salvo a mesma competência. Quando `competencia` é uma Folha, também
 * congela o total já cobrado na Prévia correspondente QUE ESSE USUÁRIO VÊ (ver
 * calcularPreviaTotalFaturaPorCcusto) — o "complementar a cobrar" mostrado depois não muda mais
 * se a Prévia for editada/reenviada.
 */
export async function POST(request: Request) {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return NextResponse.json({ error: "Sessão expirada — faça login de novo." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const competencia = typeof body?.competencia === "string" ? body.competencia : null;
  if (!competencia) {
    return NextResponse.json({ error: "Informe a competência." }, { status: 400 });
  }

  const movimentos = await listMovimentosByCompetencia(competencia);
  if (movimentos.length === 0) {
    return NextResponse.json({ error: `Nenhum lançamento encontrado para a competência ${competencia}.` }, { status: 404 });
  }

  const [{ lines, warnings }, previaTotalFaturaPorCcusto] = await Promise.all([
    calcularLinesAoVivo(competencia),
    calcularPreviaTotalFaturaPorCcusto(competencia, usuario.email),
  ]);
  const fatura = await salvarFatura(competencia, usuario, lines, warnings, previaTotalFaturaPorCcusto);

  return NextResponse.json({ salvoEm: fatura.salvoEm });
}

/** Descarta a versão ativa do usuário logado — ele volta a ver o cálculo ao vivo dessa competência (fica na timeline, marcada como descartada). Não afeta a versão de outros usuários. */
export async function DELETE(request: Request) {
  const usuario = await getUsuarioAtual();
  if (!usuario) {
    return NextResponse.json({ error: "Sessão expirada — faça login de novo." }, { status: 401 });
  }

  const url = new URL(request.url);
  const competencia = url.searchParams.get("competencia");
  if (!competencia) {
    return NextResponse.json({ error: "Informe a competência." }, { status: 400 });
  }

  await descartarFaturaSalva(competencia, usuario.email);
  return NextResponse.json({ ok: true });
}
