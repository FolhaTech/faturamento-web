import { NextResponse } from "next/server";
import { updateTomadorDoColaborador } from "@/lib/repo/colaboradores";
import { getTomador } from "@/lib/repo/tomadores";

export const runtime = "nodejs";

/** Troca o Tomador (e com ele o regime) do colaborador — seletor "Regime" no detalhamento do Faturamento (ver RegimeColaborador.tsx). */
export async function PUT(request: Request, { params }: { params: Promise<{ matricula: string }> }) {
  const { matricula } = await params;
  const body = await request.json().catch(() => null);
  const codServico = Number(body?.codServico);
  if (!Number.isInteger(codServico)) {
    return NextResponse.json({ error: "Informe codServico (número do Tomador)." }, { status: 400 });
  }

  const tomador = await getTomador(codServico);
  if (!tomador) return NextResponse.json({ error: `Tomador ${codServico} não encontrado.` }, { status: 404 });

  try {
    const colaborador = await updateTomadorDoColaborador(Number(matricula), { codigo: tomador.codigo, nome: tomador.nome });
    return NextResponse.json({ colaborador });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao salvar.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
