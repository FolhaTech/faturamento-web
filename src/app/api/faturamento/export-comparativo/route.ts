import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/lib/auth/sessao";
import { aggregateByCcusto } from "@/lib/calc/aggregate";
import { calcularPreviaTotalFaturaPorCcusto, carregarEngineLines } from "@/lib/calc/faturaCompetencia";
import { trocarTipoCompetencia } from "@/lib/calc/tipoCompetencia";
import { ComparativoPdf } from "@/lib/pdf/ComparativoPdf";

export const runtime = "nodejs";

/** PDF separado (não vai mais dentro do relatório de faturamento) só com o comparativo Prévia × Folha de um Centro de Custo — ver ComparativoPdf.tsx. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const competenciaFolha = url.searchParams.get("competencia");
  const ccustoCodigo = url.searchParams.get("ccusto") ?? "";

  if (!competenciaFolha) {
    return NextResponse.json({ error: "Informe a competência (?competencia=MM/AAAA (Folha))." }, { status: 400 });
  }

  const competenciaPrevia = trocarTipoCompetencia(competenciaFolha, "folha", "previa");
  if (!competenciaPrevia) {
    return NextResponse.json({ error: "Essa competência não é uma Folha — só dá pra comparar Prévia × Folha a partir de uma Folha." }, { status: 400 });
  }

  const usuario = await getUsuarioAtual();
  const { lines, previaTotalFaturaPorCcusto: previaCongelada } = await carregarEngineLines(competenciaFolha, usuario?.email ?? null);
  if (lines.length === 0) {
    return NextResponse.json({ error: `Nenhum lançamento encontrado para a competência ${competenciaFolha}.` }, { status: 404 });
  }

  const resumos = aggregateByCcusto(lines, competenciaFolha);
  const resumo = resumos.find((r) => r.ccustoCodigo === ccustoCodigo);
  if (!resumo) {
    return NextResponse.json({ error: "Centro de custo não encontrado nessa competência." }, { status: 404 });
  }

  const previaTotalFaturaPorCcusto = previaCongelada ?? (await calcularPreviaTotalFaturaPorCcusto(competenciaFolha, usuario?.email ?? null));
  const totalFaturaPrevia = previaTotalFaturaPorCcusto.find((p) => p.ccustoCodigo === resumo.ccustoCodigo)?.totalFatura;
  if (totalFaturaPrevia === undefined) {
    return NextResponse.json({ error: `Não há Prévia correspondente (${competenciaPrevia}) pra esse Centro de Custo.` }, { status: 404 });
  }

  // @react-pdf/renderer tipa renderToBuffer esperando um <Document> literal; ComparativoPdf
  // retorna um, mas o elemento em si é tipado pelas próprias props do componente.
  const pdfElement = createElement(ComparativoPdf, {
    ccustoNome: resumo.ccustoNome,
    tomadorNome: resumo.tomadorNome,
    competenciaFolha,
    competenciaPrevia,
    totalFaturaFolha: resumo.totalFatura,
    totalFaturaPrevia,
  }) as Parameters<typeof renderToBuffer>[0];
  const buffer = await renderToBuffer(pdfElement);

  const filename = `Comparativo-${resumo.ccustoNome}-${competenciaFolha.replace("/", "-")}.pdf`.replace(/[^a-zA-Z0-9._-]+/g, "_");

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
