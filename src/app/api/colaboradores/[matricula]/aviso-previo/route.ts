import { NextResponse } from "next/server";
import { setDescontoSaldo } from "@/lib/repo/descontosSaldo";

export const runtime = "nodejs";

/**
 * Remove o desconto de aviso prévio lançado pra esse colaborador NESSA competência (a fatura dele volta ao valor de antes do
 * desconto). Não mexe nos descontos de férias e 13º da mesma competência.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ matricula: string }> }) {
  const { matricula } = await params;
  const body = (await request.json().catch(() => ({}))) as { competencia?: string };
  const competencia = typeof body.competencia === "string" ? body.competencia.trim() : "";
  if (competencia === "") {
    return NextResponse.json({ error: "Competência inválida." }, { status: 400 });
  }

  try {
    await setDescontoSaldo(Number(matricula), competencia, "aviso", 0);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao remover.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
