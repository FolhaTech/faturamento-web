import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { aggregateByTomador } from "@/lib/calc/aggregate";
import { runEngine } from "@/lib/calc/engine";
import { filtrarLinesPorColaborador } from "@/lib/calc/filtroColaboradores";
import { FaturamentoPdf } from "@/lib/pdf/FaturamentoPdf";
import { listMovimentosByCompetencia } from "@/lib/repo/movimentos";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const competencia = url.searchParams.get("competencia");
  const tomadorCodigo = Number(url.searchParams.get("tomador"));
  const codEmp = url.searchParams.get("codEmp") ?? undefined;
  const descricaoCargo = url.searchParams.get("descricaoCargo") ?? undefined;
  const descricaoDpto = url.searchParams.get("descricaoDpto") ?? undefined;
  const descricaoCcusto = url.searchParams.get("descricaoCcusto") ?? undefined;

  if (!competencia) {
    return NextResponse.json({ error: "Informe a competência (?competencia=MM/AAAA)." }, { status: 400 });
  }

  const movimentos = await listMovimentosByCompetencia(competencia);
  if (movimentos.length === 0) {
    return NextResponse.json({ error: `Nenhum lançamento encontrado para a competência ${competencia}.` }, { status: 404 });
  }

  const { lines: allLines, warnings } = await runEngine(movimentos);
  const lines = await filtrarLinesPorColaborador(allLines, { codEmp, descricaoCargo, descricaoDpto, descricaoCcusto });
  const resumos = aggregateByTomador(lines, competencia);
  const resumo = resumos.find((r) => r.tomadorCodigo === tomadorCodigo);

  if (!resumo) {
    return NextResponse.json({ error: "Tomador não encontrado nessa competência." }, { status: 404 });
  }

  // @react-pdf/renderer tipa renderToBuffer esperando um <Document> literal; FaturamentoPdf
  // retorna um, mas o elemento em si é tipado pelas próprias props do componente.
  const pdfElement = createElement(FaturamentoPdf, { resumo, warnings }) as Parameters<typeof renderToBuffer>[0];
  const buffer = await renderToBuffer(pdfElement);

  const filename = `Faturamento-${resumo.tomadorNome}-${competencia.replace("/", "-")}.pdf`.replace(/[^a-zA-Z0-9._-]+/g, "_");

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
