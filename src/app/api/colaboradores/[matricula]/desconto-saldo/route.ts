import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/lib/auth/sessao";
import { deleteDescontoSaldoPorCompetencia, setDescontoSaldo } from "@/lib/repo/descontosSaldo";
import { editarCreditosReserva, ErroReserva, excluirCreditosReserva } from "@/lib/repo/reservasFaturadas";
import type { TipoSaldoFerias } from "@/lib/types";

export const runtime = "nodejs";

interface BodyPut {
  competencia?: string;
  ferias?: number;
  terco?: number;
  /** true = a linha editada é "Reserva da Folha" (crédito em reservas_creditos), não um desconto manual (descontos_saldo). */
  gerenciado?: boolean;
}

function parseValor(n: unknown): number {
  const v = typeof n === "string" ? Number(n.replace(",", ".")) : Number(n);
  return Number.isFinite(v) ? v : NaN;
}

export async function PUT(request: Request, { params }: { params: Promise<{ matricula: string }> }) {
  const { matricula } = await params;
  const body = (await request.json().catch(() => ({}))) as BodyPut;
  const competencia = typeof body.competencia === "string" ? body.competencia.trim() : "";
  const ferias = parseValor(body.ferias);
  const terco = parseValor(body.terco);

  if (competencia === "") {
    return NextResponse.json({ error: "Competência inválida." }, { status: 400 });
  }
  if (!Number.isFinite(ferias) || ferias < 0 || !Number.isFinite(terco) || terco < 0) {
    return NextResponse.json({ error: "Valores inválidos." }, { status: 400 });
  }

  try {
    if (body.gerenciado === true) {
      const usuario = await getUsuarioAtual();
      if (!usuario) return NextResponse.json({ error: "Sessão expirada — faça login de novo." }, { status: 401 });
      await editarCreditosReserva(Number(matricula), competencia, { ferias, terco }, usuario.email);
      return NextResponse.json({ ok: true });
    }
    await setDescontoSaldo(Number(matricula), competencia, "ferias" as TipoSaldoFerias, ferias);
    await setDescontoSaldo(Number(matricula), competencia, "terco" as TipoSaldoFerias, terco);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ErroReserva) return NextResponse.json({ error: err.message }, { status: 409 });
    const message = err instanceof Error ? err.message : "Falha ao salvar.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ matricula: string }> }) {
  const { matricula } = await params;
  const body = (await request.json().catch(() => ({}))) as { competencia?: string; gerenciado?: boolean };
  const competencia = typeof body.competencia === "string" ? body.competencia.trim() : "";

  if (competencia === "") {
    return NextResponse.json({ error: "Competência inválida." }, { status: 400 });
  }

  try {
    if (body.gerenciado === true) {
      const usuario = await getUsuarioAtual();
      if (!usuario) return NextResponse.json({ error: "Sessão expirada — faça login de novo." }, { status: 401 });
      await excluirCreditosReserva(Number(matricula), competencia, usuario.email);
      return NextResponse.json({ ok: true });
    }
    await deleteDescontoSaldoPorCompetencia(Number(matricula), competencia);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ErroReserva) return NextResponse.json({ error: err.message }, { status: 409 });
    const message = err instanceof Error ? err.message : "Falha ao excluir.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
