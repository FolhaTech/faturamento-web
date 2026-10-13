import ExcelJS from "exceljs";
import type { Celula, Coluna, RelatorioDados, Tabela } from "./relatorio";

/** Paleta do relatório (mesmo verde do PDF). ARGB. */
const VERDE = "FF0F6B4E";
const VERDE_CLARO = "FFE3F1EA";
const ZEBRA = "FFF5F8F6";
const BORDA = "FFD5DDD8";
const TEXTO_SUAVE = "FF5B6B63";
const BRANCO = "FFFFFFFF";

const FORMATO_MOEDA = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const FORMATO_PERCENTUAL = '0.##"%"';

const FONTE = "Calibri";

/** Nome de aba válido no Excel: até 31 caracteres e sem \ / ? * [ ] : */
function nomeAba(nome: string): string {
  return nome.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
}

function aplicarBorda(cell: ExcelJS.Cell) {
  const lado = { style: "thin" as const, color: { argb: BORDA } };
  cell.border = { top: lado, left: lado, bottom: lado, right: lado };
}

function preencher(cell: ExcelJS.Cell, argb: string) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

/** Faixa de título no topo de cada aba: nome do relatório + subtítulo, mescladas na largura da tabela. */
function cabecalhoDaAba(ws: ExcelJS.Worksheet, d: RelatorioDados, titulo: string, colunas: number): number {
  const ultima = Math.max(colunas, 2);
  ws.mergeCells(1, 1, 1, ultima);
  const t = ws.getCell(1, 1);
  t.value = titulo;
  t.font = { name: FONTE, size: 15, bold: true, color: { argb: BRANCO } };
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  for (let c = 1; c <= ultima; c++) preencher(ws.getCell(1, c), VERDE);
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, ultima);
  const s = ws.getCell(2, 1);
  s.value = `${d.titulo} · ${d.subtitulo}`;
  s.font = { name: FONTE, size: 10, color: { argb: TEXTO_SUAVE } };
  s.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
  ws.getRow(2).height = 20;
  return 3;
}

function configurarImpressao(ws: ExcelJS.Worksheet, linhaCabecalho?: number) {
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
    ...(linhaCabecalho ? { printTitlesRow: `${linhaCabecalho}:${linhaCabecalho}` } : {}),
  };
  ws.headerFooter.oddFooter = "&L&8&A&C&8Gerado pelo sistema de faturamento&R&8Página &P de &N";
  ws.views = [{ ...(ws.views?.[0] ?? {}), showGridLines: false }];
}

function larguraDaColuna(coluna: Coluna, indice: number, tabela: Tabela): number {
  if (coluna.tipo === "moeda") return 17;
  if (coluna.tipo === "percentual") return 11;
  if (coluna.tipo === "inteiro") return 13;
  const maior = Math.max(
    coluna.titulo.length,
    ...tabela.linhas.map((l) => String(l[indice] ?? "").length),
    String(tabela.totais?.[indice] ?? "").length,
  );
  return Math.min(Math.max(maior + 3, 11), 60);
}

function formatoDaColuna(tipo: Coluna["tipo"]): string | undefined {
  if (tipo === "moeda") return FORMATO_MOEDA;
  if (tipo === "percentual") return FORMATO_PERCENTUAL;
  if (tipo === "inteiro") return "#,##0";
  return undefined;
}

/** Escreve a tabela a partir de `linhaInicial` e devolve a próxima linha livre. Números ficam como número (somam e filtram no Excel). */
function escreverTabela(ws: ExcelJS.Worksheet, tabela: Tabela, linhaInicial: number): { proxima: number; linhaCabecalho: number } {
  const linhaCabecalho = linhaInicial;
  const cab = ws.getRow(linhaCabecalho);
  cab.height = 32;
  tabela.colunas.forEach((col, i) => {
    const cell = cab.getCell(i + 1);
    cell.value = col.titulo;
    cell.font = { name: FONTE, size: 10, bold: true, color: { argb: BRANCO } };
    cell.alignment = { vertical: "middle", horizontal: col.tipo === "texto" ? "left" : "right", wrapText: true, indent: col.tipo === "texto" ? 1 : 0 };
    preencher(cell, VERDE);
    aplicarBorda(cell);
  });

  let linha = linhaCabecalho + 1;
  tabela.linhas.forEach((dados, idx) => {
    const row = ws.getRow(linha++);
    row.height = 19;
    dados.forEach((valor: Celula, i) => {
      const col = tabela.colunas[i];
      const cell = row.getCell(i + 1);
      cell.value = valor === null ? "—" : valor;
      const numerico = col.tipo !== "texto" && valor !== null;
      if (numerico) cell.numFmt = formatoDaColuna(col.tipo) ?? "General";
      cell.font = { name: FONTE, size: 10, bold: col.destaque === true, color: { argb: valor === null ? "FFB5BFB9" : "FF1F2A25" } };
      cell.alignment = { vertical: "middle", horizontal: col.tipo === "texto" && valor !== null && !/^\d{2}\/\d{2}\/\d{4}$/.test(String(valor)) ? "left" : col.tipo === "texto" ? "center" : "right", indent: col.tipo === "texto" ? 1 : 0 };
      if (idx % 2 === 1) preencher(cell, ZEBRA);
      aplicarBorda(cell);
    });
  });

  if (tabela.totais) {
    const row = ws.getRow(linha++);
    row.height = 22;
    tabela.totais.forEach((valor, i) => {
      const col = tabela.colunas[i];
      const cell = row.getCell(i + 1);
      cell.value = valor === null ? "" : valor;
      if (valor !== null && col.tipo !== "texto") cell.numFmt = formatoDaColuna(col.tipo) ?? "General";
      cell.font = { name: FONTE, size: 10, bold: true, color: { argb: VERDE } };
      cell.alignment = { vertical: "middle", horizontal: col.tipo === "texto" ? "left" : "right", indent: col.tipo === "texto" ? 1 : 0 };
      preencher(cell, VERDE_CLARO);
      const topo = { style: "medium" as const, color: { argb: VERDE } };
      cell.border = { top: topo, bottom: { style: "thin", color: { argb: BORDA } } };
    });
  }

  ws.autoFilter = { from: { row: linhaCabecalho, column: 1 }, to: { row: linhaCabecalho, column: tabela.colunas.length } };
  ws.views = [{ state: "frozen", ySplit: linhaCabecalho, showGridLines: false }];
  return { proxima: linha + 1, linhaCabecalho };
}

function escreverNota(ws: ExcelJS.Worksheet, texto: string, linha: number, colunas: number) {
  ws.mergeCells(linha, 1, linha, colunas);
  const cell = ws.getCell(linha, 1);
  cell.value = texto;
  cell.font = { name: FONTE, size: 9, italic: true, color: { argb: TEXTO_SUAVE } };
  cell.alignment = { vertical: "top", horizontal: "left", wrapText: true, indent: 1 };
  ws.getRow(linha).height = Math.max(16, Math.ceil(texto.length / 150) * 14);
}

function abaTabela(wb: ExcelJS.Workbook, d: RelatorioDados, nome: string, titulo: string, tabela: Tabela) {
  const ws = wb.addWorksheet(nomeAba(nome), { properties: { tabColor: { argb: VERDE } } });
  tabela.colunas.forEach((col, i) => {
    ws.getColumn(i + 1).width = larguraDaColuna(col, i, tabela);
  });
  const inicio = cabecalhoDaAba(ws, d, titulo, tabela.colunas.length);
  const { proxima, linhaCabecalho } = escreverTabela(ws, tabela, inicio + 1);
  if (tabela.nota) escreverNota(ws, tabela.nota, proxima, tabela.colunas.length);
  configurarImpressao(ws, linhaCabecalho);
  // O painel congelado precisa ficar depois de configurarImpressao (que redefine as views).
  ws.views = [{ state: "frozen", ySplit: linhaCabecalho, showGridLines: false }];
}

function abaResumo(wb: ExcelJS.Workbook, d: RelatorioDados) {
  const ws = wb.addWorksheet("Resumo", { properties: { tabColor: { argb: VERDE } } });
  ws.getColumn(1).width = 52;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 4;
  ws.getColumn(4).width = 52;
  ws.getColumn(5).width = 22;

  ws.mergeCells("A1:E1");
  const eyebrow = ws.getCell("A1");
  eyebrow.value = d.eyebrow.toUpperCase();
  eyebrow.font = { name: FONTE, size: 10, bold: true, color: { argb: BRANCO } };
  eyebrow.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  for (const c of ["A1", "B1", "C1", "D1", "E1"]) preencher(ws.getCell(c), VERDE);
  ws.getRow(1).height = 22;

  ws.mergeCells("A2:E2");
  const titulo = ws.getCell("A2");
  titulo.value = d.titulo;
  titulo.font = { name: FONTE, size: 20, bold: true, color: { argb: BRANCO } };
  titulo.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  for (const c of ["A2", "B2", "C2", "D2", "E2"]) preencher(ws.getCell(c), VERDE);
  ws.getRow(2).height = 34;

  const meta = [d.subtitulo, ...(d.vinculo ? [d.vinculo] : []), `Gerado em ${d.geradoEm} · ${d.qtdColaboradores} colaborador(es)`];
  meta.forEach((texto, i) => {
    const linha = 3 + i;
    ws.mergeCells(linha, 1, linha, 5);
    const cell = ws.getCell(linha, 1);
    cell.value = texto;
    cell.font = { name: FONTE, size: 10, color: { argb: TEXTO_SUAVE } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(linha).height = 18;
  });

  const linhaSecao = 3 + meta.length + 1;
  for (const [coluna, titulo] of [[1, "Totais da fatura"], [4, "Retenções e valor líquido"]] as const) {
    ws.mergeCells(linhaSecao, coluna, linhaSecao, coluna + 1);
    const cell = ws.getCell(linhaSecao, coluna);
    cell.value = titulo;
    cell.font = { name: FONTE, size: 12, bold: true, color: { argb: VERDE } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    const sublinhado = { style: "medium" as const, color: { argb: VERDE } };
    cell.border = { bottom: sublinhado };
    ws.getCell(linhaSecao, coluna + 1).border = { bottom: sublinhado };
  }
  ws.getRow(linhaSecao).height = 24;

  const escreverBloco = (linhas: RelatorioDados["resumo"]["totais"], coluna: number) => {
    linhas.forEach((l, i) => {
      const linha = linhaSecao + 1 + i;
      const rotulo = ws.getCell(linha, coluna);
      const valor = ws.getCell(linha, coluna + 1);
      rotulo.value = l.rotulo;
      valor.value = l.valor;
      valor.numFmt = FORMATO_MOEDA;
      for (const cell of [rotulo, valor]) {
        cell.font = { name: FONTE, size: l.destaque ? 11 : 10, bold: l.destaque === true, color: { argb: l.destaque ? VERDE : "FF1F2A25" } };
        cell.alignment = { vertical: "middle", horizontal: cell === valor ? "right" : "left", indent: cell === valor ? 0 : 1 };
        if (l.destaque) preencher(cell, VERDE_CLARO);
        const fina = { style: "thin" as const, color: { argb: BORDA } };
        cell.border = { bottom: fina };
      }
      ws.getRow(linha).height = l.destaque ? 24 : 20;
    });
  };
  escreverBloco(d.resumo.totais, 1);
  escreverBloco(d.resumo.retencoes, 4);

  configurarImpressao(ws);
}

/** Excel do relatório: uma aba por seção (Resumo, Eventos, Descontos, Colaboradores), formatado e pronto pra imprimir. */
export async function gerarExcel(d: RelatorioDados): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema de Faturamento";
  wb.created = new Date();
  wb.title = `Faturamento - ${d.titulo} - ${d.competencia}`;

  abaResumo(wb, d);
  abaTabela(wb, d, "Eventos", "Detalhamento por evento", d.eventos);
  if (d.descontos) abaTabela(wb, d, "Descontos", "Descontos e linhas informativas", d.descontos);
  abaTabela(wb, d, "Colaboradores", `Detalhamento por colaborador (${d.qtdColaboradores})`, d.colaboradores);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
