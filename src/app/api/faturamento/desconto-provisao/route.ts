import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/lib/auth/sessao";
import { mesReserva, PERIODO_FOLHA, type ReservaTipo } from "@/lib/calc/reservasFaturadas";
import { alterarReserva, consultarReservas, ErroReserva } from "@/lib/repo/reservasFaturadas";

export const runtime = "nodejs";
const erro = (error: string, status = 400) => NextResponse.json({ error }, { status });
const periodoValido = (p: unknown): p is string => typeof p === "string" && /^(0[1-9]|1[0-2])\/\d{4}$/.test(p);

export async function GET(request: Request) {
  if (!await getUsuarioAtual()) return erro("Sessão expirada.", 401);
  const matricula = Number(new URL(request.url).searchParams.get("matricula"));
  if (!Number.isSafeInteger(matricula) || matricula <= 0) return erro("Matrícula inválida.");
  return NextResponse.json(await consultarReservas(matricula));
}

export async function PUT(request: Request) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return erro("Sessão expirada.", 401);
  const b = await request.json().catch(() => null);
  if (!b || !Number.isSafeInteger(b.matricula) || b.matricula <= 0 || typeof b.competencia !== "string" || mesReserva(b.competencia) === null) return erro("Matrícula ou competência inválida.");
  try {
    if (b.tipo === "cobranca") {
      const { ferias, terco, aviso, periodo, referencia } = b;
      if (![ferias, terco, aviso].every((n) => Number.isInteger(n) && n >= 0 && n <= 2147483647)
        || ferias + terco + aviso === 0 || (ferias > 0 && !periodoValido(periodo))
        || typeof referencia !== "string" || !referencia.trim() || referencia.length > 160) {
        return erro("Informe os valores cobrados, o início do período das férias e a referência da fatura.");
      }
      await alterarReserva(b.matricula, b.competencia, { tipo: "cobranca", referencia: referencia.trim(), cobranca: { ferias, terco, aviso, periodo: ferias > 0 ? periodo : "" } }, usuario.email);
    } else {
      if (!["ferias", "terco", "aviso"].includes(b.reserva)) return erro("Reserva inválida.");
      const reserva = b.reserva as ReservaTipo;
      if (b.tipo === "retirar") {
        await alterarReserva(b.matricula, b.competencia, { tipo: "retirar", reserva }, usuario.email);
      } else if (b.tipo === "aplicar" && Number.isSafeInteger(b.esperado) && b.esperado > 0 && (reserva !== "ferias" || ((periodoValido(b.periodo) || b.periodo === PERIODO_FOLHA || b.periodo === "*")))) {
        await alterarReserva(b.matricula, b.competencia, { tipo: "aplicar", reserva, periodo: reserva === "ferias" ? b.periodo : "", esperado: b.esperado }, usuario.email);
      } else return erro("Informe um crédito válido e o período de férias.");
    }
    return NextResponse.json(await consultarReservas(b.matricula));
  } catch (e) {
    if (e instanceof ErroReserva) return erro(e.message, 409);
    console.error("[reservas faturadas]", e);
    return erro("Não foi possível atualizar a reserva.", 500);
  }
}
