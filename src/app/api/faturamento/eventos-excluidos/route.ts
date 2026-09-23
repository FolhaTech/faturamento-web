import { NextResponse } from "next/server";
import { excluirEvento, restaurarEvento } from "@/lib/repo/eventosExcluidos";

export const runtime = "nodejs";

/** Exclui um evento da fatura do Centro de Custo INTEIRO (todos os colaboradores) numa competência — ver eventosExcluidos.ts. A confirmação ("tem certeza?") é feita na tela antes de chamar aqui. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const ccustoCodigo = typeof body?.ccustoCodigo === "string" ? body.ccustoCodigo : null;
  const competencia = typeof body?.competencia === "string" ? body.competencia : null;
  const evento = typeof body?.evento === "string" ? body.evento : null;
  if (!ccustoCodigo || !competencia || !evento) {
    return NextResponse.json({ error: "Informe ccustoCodigo, competencia e evento." }, { status: 400 });
  }

  await excluirEvento(ccustoCodigo, competencia, evento);
  return NextResponse.json({ ok: true });
}

/** Restaura um evento excluído — volta a contar no cálculo ao vivo da competência. */
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const ccustoCodigo = url.searchParams.get("ccustoCodigo");
  const competencia = url.searchParams.get("competencia");
  const evento = url.searchParams.get("evento");
  if (!ccustoCodigo || !competencia || !evento) {
    return NextResponse.json({ error: "Informe ccustoCodigo, competencia e evento." }, { status: 400 });
  }

  await restaurarEvento(ccustoCodigo, competencia, evento);
  return NextResponse.json({ ok: true });
}
