import { NextResponse } from "next/server";
import { excluirEvento, restaurarEvento } from "@/lib/repo/eventosExcluidos";

export const runtime = "nodejs";

/** Exclui um evento da fatura de UM colaborador numa competência — ver eventosExcluidos.ts. A confirmação ("tem certeza?") é feita na tela antes de chamar aqui. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const matricula = typeof body?.matricula === "number" ? body.matricula : null;
  const competencia = typeof body?.competencia === "string" ? body.competencia : null;
  const evento = typeof body?.evento === "string" ? body.evento : null;
  if (matricula === null || !competencia || !evento) {
    return NextResponse.json({ error: "Informe matricula, competencia e evento." }, { status: 400 });
  }

  await excluirEvento(matricula, competencia, evento);
  return NextResponse.json({ ok: true });
}

/** Restaura um evento excluído — volta a contar no cálculo ao vivo desse colaborador na competência. */
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const matriculaParam = url.searchParams.get("matricula");
  const matricula = matriculaParam !== null ? Number(matriculaParam) : null;
  const competencia = url.searchParams.get("competencia");
  const evento = url.searchParams.get("evento");
  if (matricula === null || !Number.isFinite(matricula) || !competencia || !evento) {
    return NextResponse.json({ error: "Informe matricula, competencia e evento." }, { status: 400 });
  }

  await restaurarEvento(matricula, competencia, evento);
  return NextResponse.json({ ok: true });
}
