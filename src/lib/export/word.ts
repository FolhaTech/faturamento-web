import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeightRule,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  PageOrientation,
} from "docx";
import type { Celula, Coluna, LinhaResumo, RelatorioDados, Tabela } from "./relatorio";

const VERDE = "0F6B4E";
const VERDE_CLARO = "E3F1EA";
const ZEBRA = "F5F8F6";
const BORDA = "D5DDD8";
const TEXTO = "1F2A25";
const TEXTO_SUAVE = "5B6B63";
const FONTE = "Calibri";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** A4 em paisagem: o `docx` recebe a página em pé e inverte quando a orientação é paisagem. Margens de ~1,5 cm. */
const LARGURA_PAGINA = 11906;
const ALTURA_PAGINA = 16838;
const MARGEM = 850;
const LARGURA_UTIL = ALTURA_PAGINA - MARGEM * 2;

function formatar(valor: Celula, coluna: Coluna): string {
  if (valor === null) return "—";
  if (typeof valor === "string") return valor;
  if (coluna.tipo === "moeda") return moeda.format(valor);
  if (coluna.tipo === "percentual") return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  return valor.toLocaleString("pt-BR");
}

function texto(t: string, opts: { bold?: boolean; italics?: boolean; size?: number; color?: string; caps?: boolean } = {}) {
  return new TextRun({ text: t, font: FONTE, bold: opts.bold, italics: opts.italics, size: opts.size ?? 18, color: opts.color ?? TEXTO, allCaps: opts.caps });
}

const bordaFina = { style: BorderStyle.SINGLE, size: 4, color: BORDA } as const;
const bordasTabela = {
  top: bordaFina,
  bottom: bordaFina,
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideHorizontal: bordaFina,
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
} as const;

/** Larguras (DXA) proporcionais aos pesos das colunas, somando exatamente a largura útil da página. */
function larguras(colunas: Coluna[]): number[] {
  const total = colunas.reduce((s, c) => s + c.peso, 0);
  const dxa = colunas.map((c) => Math.floor((c.peso / total) * LARGURA_UTIL));
  dxa[dxa.length - 1] += LARGURA_UTIL - dxa.reduce((s, n) => s + n, 0);
  return dxa;
}

function celula(
  conteudo: string,
  largura: number,
  opts: { alinhar: "left" | "right" | "center"; fundo?: string; bold?: boolean; cor?: string; tamanho?: number },
) {
  return new TableCell({
    width: { size: largura, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    shading: opts.fundo ? { type: ShadingType.CLEAR, color: "auto", fill: opts.fundo } : undefined,
    children: [
      new Paragraph({
        alignment: opts.alinhar === "right" ? AlignmentType.RIGHT : opts.alinhar === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [texto(conteudo, { bold: opts.bold, color: opts.cor, size: opts.tamanho ?? 15 })],
      }),
    ],
  });
}

function tabela(t: Tabela): Table {
  const w = larguras(t.colunas);
  // Tabelas largas (14 colunas) pedem fonte menor pra caber numa linha só.
  const tamanho = t.colunas.length > 10 ? 14 : 16;

  const cabecalho = new TableRow({
    tableHeader: true,
    cantSplit: true,
    height: { value: 520, rule: HeightRule.ATLEAST },
    children: t.colunas.map((c, i) =>
      celula(c.titulo, w[i], { alinhar: c.tipo === "texto" ? "left" : "right", fundo: VERDE, bold: true, cor: "FFFFFF", tamanho }),
    ),
  });

  const corpo = t.linhas.map(
    (linha, idx) =>
      new TableRow({
        cantSplit: true,
        children: linha.map((valor, i) => {
          const c = t.colunas[i];
          const data = c.tipo === "texto" && typeof valor === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(valor);
          return celula(formatar(valor, c), w[i], {
            alinhar: c.tipo === "texto" ? (data ? "center" : "left") : "right",
            fundo: idx % 2 === 1 ? ZEBRA : undefined,
            bold: c.destaque,
            cor: valor === null ? "B5BFB9" : TEXTO,
            tamanho,
          });
        }),
      }),
  );

  const linhas = [cabecalho, ...corpo];
  if (t.totais) {
    linhas.push(
      new TableRow({
        cantSplit: true,
        children: t.totais.map((valor, i) =>
          celula(valor === null ? "" : formatar(valor, t.colunas[i]), w[i], {
            alinhar: t.colunas[i].tipo === "texto" ? "left" : "right",
            fundo: VERDE_CLARO,
            bold: true,
            cor: VERDE,
            tamanho,
          }),
        ),
      }),
    );
  }

  return new Table({ width: { size: LARGURA_UTIL, type: WidthType.DXA }, columnWidths: w, layout: TableLayoutType.FIXED, borders: bordasTabela, rows: linhas });
}

function titulo(textoTitulo: string, novaPagina: boolean): Paragraph {
  return new Paragraph({
    pageBreakBefore: novaPagina,
    spacing: { before: novaPagina ? 0 : 280, after: 140 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: VERDE, space: 4 } },
    children: [texto(textoTitulo, { bold: true, size: 26, color: VERDE })],
  });
}

function nota(t: string): Paragraph {
  return new Paragraph({ spacing: { before: 100 }, children: [texto(t, { italics: true, size: 15, color: TEXTO_SUAVE })] });
}

/** Resumo em duas colunas lado a lado (totais à esquerda, retenções e líquido à direita), com os valores principais em destaque. */
function blocoResumo(totais: LinhaResumo[], retencoes: LinhaResumo[]): Table {
  const metade = Math.floor(LARGURA_UTIL / 2);
  const rotuloW = Math.floor(metade * 0.66);
  const valorW = metade - rotuloW;
  const colunas = [rotuloW, valorW, rotuloW, valorW];
  const n = Math.max(totais.length, retencoes.length);

  const par = (l: LinhaResumo | undefined, rotuloLargura: number, valorLargura: number) => {
    const fundo = l?.destaque ? VERDE_CLARO : undefined;
    return [
      celula(l?.rotulo ?? "", rotuloLargura, { alinhar: "left", fundo, bold: l?.destaque, cor: l?.destaque ? VERDE : TEXTO, tamanho: l?.destaque ? 19 : 17 }),
      celula(l ? moeda.format(l.valor) : "", valorLargura, { alinhar: "right", fundo, bold: true, cor: l?.destaque ? VERDE : TEXTO, tamanho: l?.destaque ? 19 : 17 }),
    ];
  };

  const linhas = Array.from({ length: n }, (_, i) => new TableRow({ cantSplit: true, children: [...par(totais[i], rotuloW, valorW), ...par(retencoes[i], rotuloW, valorW)] }));
  return new Table({
    width: { size: LARGURA_UTIL, type: WidthType.DXA },
    columnWidths: colunas,
    layout: TableLayoutType.FIXED,
    borders: { ...bordasTabela, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
    rows: linhas,
  });
}

/** Word do relatório: capa com o resumo e uma seção por página (eventos, descontos, colaboradores), em A4 paisagem. */
export async function gerarWord(d: RelatorioDados): Promise<Buffer> {
  const cabecalho: Paragraph[] = [
    new Paragraph({ spacing: { after: 40 }, children: [texto(d.eyebrow, { size: 17, color: VERDE, caps: true, bold: true })] }),
    new Paragraph({ spacing: { after: 60 }, children: [texto(d.titulo, { size: 44, bold: true })] }),
    new Paragraph({ spacing: { after: 40 }, children: [texto(d.subtitulo, { size: 20, color: TEXTO_SUAVE })] }),
    ...(d.vinculo ? [new Paragraph({ spacing: { after: 40 }, children: [texto(d.vinculo, { size: 20, color: TEXTO_SUAVE })] })] : []),
    new Paragraph({
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 14, color: VERDE, space: 6 } },
      children: [texto(`Gerado em ${d.geradoEm} · ${d.qtdColaboradores} colaborador(es)`, { size: 17, color: TEXTO_SUAVE })],
    }),
  ];

  const filhos: (Paragraph | Table)[] = [...cabecalho, titulo("Resumo", false), blocoResumo(d.resumo.totais, d.resumo.retencoes)];

  filhos.push(titulo("Detalhamento por evento", true), tabela(d.eventos));
  if (d.eventos.nota) filhos.push(nota(d.eventos.nota));

  if (d.descontos) {
    filhos.push(titulo("Descontos e linhas informativas", true), tabela(d.descontos));
    if (d.descontos.nota) filhos.push(nota(d.descontos.nota));
  }

  filhos.push(titulo(`Detalhamento por colaborador (${d.qtdColaboradores})`, true), tabela(d.colaboradores));

  const doc = new Document({
    creator: "Sistema de Faturamento",
    title: `Faturamento - ${d.titulo} - ${d.competencia}`,
    styles: { default: { document: { run: { font: FONTE, size: 18 } } } },
    sections: [
      {
        properties: {
          page: { size: { width: LARGURA_PAGINA, height: ALTURA_PAGINA, orientation: PageOrientation.LANDSCAPE }, margin: { top: MARGEM, bottom: MARGEM, left: MARGEM, right: MARGEM } },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDA, space: 4 } },
                children: [
                  texto(`${d.rodape}     •     página `, { size: 15, color: TEXTO_SUAVE }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONTE, size: 15, color: TEXTO_SUAVE }),
                  texto(" de ", { size: 15, color: TEXTO_SUAVE }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONTE, size: 15, color: TEXTO_SUAVE }),
                ],
              }),
            ],
          }),
        },
        children: filhos,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
