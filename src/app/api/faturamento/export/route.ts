import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/lib/auth/sessao";
import { aggregateByCcusto } from "@/lib/calc/aggregate";
import { carregarEngineLines } from "@/lib/calc/faturaCompetencia";
import { filtrarLinesPorColaborador } from "@/lib/calc/filtroColaboradores";
import { gerarExcel } from "@/lib/export/excel";
import { montarRelatorio } from "@/lib/export/relatorio";
import { gerarWord } from "@/lib/export/word";
import { adiantamentoAtivo, juntarDeducoes, lerAdiantamentosSerializados, lerPercentuaisSerializados, lerValorReais } from "@/lib/percentualCobranca";
import { FaturamentoPdf } from "@/lib/pdf/FaturamentoPdf";
import { getColaboradoresPorMatriculas } from "@/lib/repo/colaboradores";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const competencia = url.searchParams.get("competencia");
  const ccustoCodigo = url.searchParams.get("ccusto") ?? "";
  const codEmp = url.searchParams.get("codEmp") ?? undefined;
  const descricaoCargo = url.searchParams.get("descricaoCargo") ?? undefined;
  const descricaoDpto = url.searchParams.get("descricaoDpto") ?? undefined;
  // Matrícula exata: PDF individual de um colaborador (botão "PDF" na linha dele no Faturamento).
  const colaborador = url.searchParams.get("colaborador")?.trim() || undefined;
  const regimeParam = url.searchParams.get("regime");
  const fpas = regimeParam === "515" || regimeParam === "655" ? (Number(regimeParam) as 515 | 655) : undefined;
  // Deduções digitadas na tela por colaborador — percentual da NF ("matrícula:%,...") e adiantamento em reais
  // ("matrícula:valor,...", ver FaturamentoViewer): saem no Resumo e no detalhamento por colaborador do PDF;
  // ausentes ou malformados = sem as colunas.
  const deducoesCobranca = juntarDeducoes(
    lerPercentuaisSerializados(url.searchParams.get("percentuais")),
    lerAdiantamentosSerializados(url.searchParams.get("adiantamentos")),
  );
  // Base das retenções (R$) digitada à mão no card do centro de custo (?baseRetencoes=9274.42): os tributos saem dela em vez do
  // valor calculado. Ausente, vazia ou inválida = base calculada.
  const baseRetencoesInformada = adiantamentoAtivo(url.searchParams.get("baseRetencoes") ?? "");
  // INSS (R$) digitado à mão no card (?inss=7234.83): troca o INSS calculado e entra no total das retenções e no líquido. Vazio ou
  // inválido = INSS calculado; 0 vale (INSS zerado).
  const inssInformado = lerValorReais(url.searchParams.get("inss") ?? "");

  if (!competencia) {
    return NextResponse.json({ error: "Informe a competência (?competencia=MM/AAAA)." }, { status: 400 });
  }

  // Competência já salva PELO USUÁRIO LOGADO (ver faturasSalvas.ts): usa a foto congelada em vez
  // de recalcular ao vivo, pra o PDF exportado nunca divergir do que está (ou estava, se algo
  // mudou depois) na tela desse usuário — mesma fonte de dados de src/app/faturamento/page.tsx.
  const usuario = await getUsuarioAtual();
  // Os avisos do cálculo ficam só na tela (painel "aviso(s) durante o cálculo") — não saem no PDF.
  // ?versao=: fatura salva por outra pessoa aberta na tela (ver VersaoDeOutroBanner) — o arquivo sai exatamente dela.
  const { lines: allLines } = await carregarEngineLines(competencia, usuario?.email ?? null, url.searchParams.get("versao")?.trim() || null);
  if (allLines.length === 0) {
    return NextResponse.json({ error: `Nenhum lançamento encontrado para a competência ${competencia}.` }, { status: 404 });
  }

  const lines = await filtrarLinesPorColaborador(allLines, { codEmp, descricaoCargo, descricaoDpto, fpas, colaborador });
  const resumos = aggregateByCcusto(lines, competencia);
  const resumo = resumos.find((r) => r.ccustoCodigo === ccustoCodigo);

  if (!resumo) {
    return NextResponse.json({ error: "Centro de custo não encontrado nessa competência." }, { status: 404 });
  }

  // Rótulo do regime quando o filtro está ativo — aparece no PDF e no nome do arquivo pra não
  // sair um "Faturamento-X.pdf" idêntico ao da folha inteira, só com números diferentes.
  const regimeLabel = fpas === 515 ? "Terceiro (CLT)" : fpas === 655 ? "Temporário" : null;

  // CC (não obrigatório, digitado na tela de Faturamento) não vem do motor de cálculo.
  const colaboradoresPorMatricula = await getColaboradoresPorMatriculas(resumo.colaboradores.map((c) => c.matricula));
  const ccPorMatricula = new Map([...colaboradoresPorMatricula].map(([matricula, colaborador]) => [matricula, colaborador.cc]));
  // Admissão e rescisão (planilha mensal Empregados em Excel, ver /api/colaboradores/vinculos) — colunas e cabeçalho do PDF.
  const vinculoPorMatricula = new Map(
    [...colaboradoresPorMatricula].map(([matricula, c]) => [
      matricula,
      { admissao: c.admissao, dataDemissao: c.dataDemissao, motivoDemissao: c.dados.motivo_demissao ? String(c.dados.motivo_demissao) : null },
    ]),
  );

  // PDF individual: o filtro por matrícula deixa um único colaborador no resumo — o nome vai no cabeçalho e no arquivo.
  const individual = colaborador && resumo.colaboradores.length === 1 ? resumo.colaboradores[0] : null;
  const colaboradorLabel = individual ? `${individual.nome} (${individual.matricula})` : null;

  // Mesmo relatório em três formatos (?formato=pdf|docx|xlsx, padrão pdf): os três mostram as mesmas informações.
  const formato = FORMATOS[url.searchParams.get("formato") ?? "pdf"] ?? FORMATOS.pdf;

  let buffer: Buffer | Uint8Array;
  if (formato.extensao === "pdf") {
    // @react-pdf/renderer tipa renderToBuffer esperando um <Document> literal; FaturamentoPdf
    // retorna um, mas o elemento em si é tipado pelas próprias props do componente.
    const pdfElement = createElement(FaturamentoPdf, {
      resumo,
      regimeLabel,
      ccPorMatricula,
      deducoesCobranca,
      colaboradorLabel,
      vinculoPorMatricula,
      baseRetencoesInformada,
      inssInformado,
    }) as Parameters<typeof renderToBuffer>[0];
    buffer = await renderToBuffer(pdfElement);
  } else {
    const dados = montarRelatorio({ resumo, regimeLabel, ccPorMatricula, deducoes: deducoesCobranca, vinculoPorMatricula, colaboradorLabel, baseRetencoesInformada, inssInformado });
    buffer = formato.extensao === "docx" ? await gerarWord(dados) : await gerarExcel(dados);
  }

  const filename = `Faturamento-${resumo.ccustoNome}-${competencia.replace("/", "-")}${regimeLabel ? `-${regimeLabel}` : ""}${individual ? `-${individual.nome}` : ""}.${formato.extensao}`.replace(
    /[^a-zA-Z0-9._-]+/g,
    "_",
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": formato.contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

const FORMATOS: Record<string, { extensao: "pdf" | "docx" | "xlsx"; contentType: string }> = {
  pdf: { extensao: "pdf", contentType: "application/pdf" },
  docx: { extensao: "docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  xlsx: { extensao: "xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
};
