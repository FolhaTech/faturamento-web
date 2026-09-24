import type { MovimentoInput } from "../repo/movimentos";
import { normalizaTexto } from "../text";
import type { TipoEvento } from "../types";
import { readWorkbookGrid, type SheetGrid } from "./grid";
import { asNumber, asString, detectHeaderRow, headerMap, iterateRows, requireHeaders } from "./readTable";

const TIPOS_VALIDOS: readonly TipoEvento[] = ["P", "D", "I", "R", "FGTS", "INSS"];

function toTipo(raw: string | null): TipoEvento {
  const v = (raw ?? "").trim().toUpperCase();
  return (TIPOS_VALIDOS as readonly string[]).includes(v) ? (v as TipoEvento) : "I";
}

/**
 * Layout "rico": aba Movimentos com cabeçalho textual (Código, Matrícula,
 * Nome, Evento, Comp, Valor, Ref, Tipo, Fórma em colunas separadas), como
 * aparece dentro de uma planilha de movimentação-modelo completa.
 */
function parseRico(sheet: SheetGrid): MovimentoInput[] {
  const headerRow = detectHeaderRow(sheet, ["Código"], 4);
  const h = headerMap(sheet, headerRow);
  requireHeaders("Movimentos", h, ["Código", "Matrícula", "Nome", "Evento", "Comp", "Valor", "Ref", "Tipo"]);
  const out: MovimentoInput[] = [];
  for (const { get } of iterateRows(sheet, headerRow)) {
    const matricula = asNumber(get(h.get("Matrícula")!));
    const codigo = asNumber(get(h.get("Código")!));
    if (!matricula || !codigo) continue;
    out.push({
      codigo,
      matricula,
      nome: asString(get(h.get("Nome")!)) ?? "",
      evento: asString(get(h.get("Evento")!)) ?? "",
      competencia: asString(get(h.get("Comp")!)) ?? "",
      valor: asNumber(get(h.get("Valor")!)),
      ref: asNumber(get(h.get("Ref")!)),
      tipo: toTipo(asString(get(h.get("Tipo")!))),
      forma: asString(get(h.get("Fórma")!)),
    });
  }
  return out;
}

const MATRICULA_NOME_RE = /^\s*(\d+)\s*-\s*(.+?)\s*$/;

/**
 * Layout "cru": exportação mensal direta do sistema de folha — sem
 * cabeçalho, colunas fixas por posição (A Código, B "matrícula - nome", C
 * Evento, D Comp, E Valor, F Ref, G Tipo, H Fórma). É o formato que chega
 * todo mês na prática (ex.: Movimentos072026.xls).
 */
function parseCru(sheet: SheetGrid): MovimentoInput[] {
  const out: MovimentoInput[] = [];
  for (const row of sheet.rows) {
    if (!row || row.length === 0) continue;
    const codigo = asNumber(row[0]);
    const colaboradorRaw = asString(row[1]);
    if (!codigo || !colaboradorRaw) continue;
    const m = colaboradorRaw.match(MATRICULA_NOME_RE);
    if (!m) continue;
    out.push({
      codigo,
      matricula: Number(m[1]),
      nome: m[2],
      evento: asString(row[2]) ?? "",
      competencia: asString(row[3]) ?? "",
      valor: asNumber(row[4]),
      ref: asNumber(row[5]),
      tipo: toTipo(asString(row[6])),
      forma: asString(row[7]),
    });
  }
  return out;
}

function isLayoutCru(sheet: SheetGrid): boolean {
  for (let r = 0; r < Math.min(4, sheet.rows.length); r++) {
    const row = sheet.rows[r] ?? [];
    if (row.some((v) => typeof v === "string" && v.trim() === "Código")) return false;
  }
  const first = sheet.rows[0]?.[0];
  return typeof first === "number";
}

/**
 * Layout "relatório impresso": exportação em formato de relatório paginado
 * (ex.: Movimentos hospitau.xlsx) — cabeçalho Empresa/CNPJ/Competência e a
 * linha de colunas se repetem a cada página impressa, o colaborador
 * ("matrícula - nome") aparece numa linha própria acima dos lançamentos
 * (não repetido em cada linha) e há linhas de subtotal ("Total do
 * Empregado:", "Total da empresa:") intercaladas. A(0) Código e E(4) Nome do
 * evento são fixos por posição; os demais campos (Referência/Comp, Valor
 * calculado, Valor informado, Tipo, Unidade, Local de trabalho) são achados
 * pelo texto do cabeçalho — ver acharColuna — porque exports diferentes do
 * mesmo relatório (ex.: um Centro de Custo com uma coluna extra no meio)
 * deslocam essas colunas pra direita mantendo a mesma distância entre o
 * rótulo (geralmente mesclado sobre mais de uma coluna) e o valor de fato;
 * confiar em posição fixa lia célula vazia nesses casos e o lançamento
 * entrava com competência em branco.
 */
function isLayoutRelatorio(sheet: SheetGrid): boolean {
  const first = sheet.rows[0]?.[0];
  return typeof first === "string" && first.trim() === "Empresa:";
}

const CODIGO_NOME_RE = /^\s*\d+\s*-\s*(.+?)\s*$/;

/**
 * Nome do Tomador a partir do cabeçalho "Empresa:" do layout "relatório" (linha repetida a
 * cada página impressa, ex.: "4 - GENTER SERVICOS EM RECURSOS HUMANOS LTDA") — usado pra
 * vincular automaticamente colaboradores sem Cód Serviço ao Tomador certo (ver
 * /api/movimentos). O código numérico antes do "-" é do sistema de folha de origem, não bate
 * com o `codigo` do Tomador cadastrado aqui — só o nome depois do "-" é usado.
 */
function extractEmpresaNome(sheet: SheetGrid): string | null {
  for (const row of sheet.rows) {
    if (!row || row.length === 0) continue;
    const label = asString(row[0]);
    if (!label || label.trim().toUpperCase() !== "EMPRESA:") continue;
    for (let i = 1; i < row.length; i++) {
      const v = asString(row[i]);
      if (!v) continue;
      const m = v.match(CODIGO_NOME_RE);
      if (m) return m[1];
    }
  }
  return null;
}

const LOCAL_TRABALHO_LABEL_RE = /^LOCAL DE TRABALHO$/i;
/** Coluna observada no layout real quando o cabeçalho de título ("Local de trabalho") não é encontrado no arquivo. */
const COLUNA_LOCAL_TRABALHO_PADRAO = 29;

/** Acha a coluna "Local de trabalho" pelo texto do cabeçalho (repete a cada página) em vez de fixar a posição — mais resiliente a variações de layout entre exportações. */
function acharColunaLocalTrabalho(sheet: SheetGrid): number {
  for (const row of sheet.rows) {
    if (!row) continue;
    const idx = row.findIndex((v) => typeof v === "string" && LOCAL_TRABALHO_LABEL_RE.test(v.trim()));
    if (idx !== -1) return idx;
  }
  return COLUNA_LOCAL_TRABALHO_PADRAO;
}

/**
 * Acha a coluna de um rótulo de cabeçalho (Referência, Valor calculado, Valor informado, Tipo,
 * Unidade) pelo texto, só dentro de linhas que também têm "Código" — a linha de cabeçalho de
 * verdade, que se repete a cada página impressa — em vez de casar o rótulo em qualquer célula
 * solta da planilha. Cai no `fallback` (posição observada no arquivo de referência, Movimentos
 * hospitau.xlsx) quando o rótulo não aparece em nenhuma linha de cabeçalho.
 *
 * Por que não fixar a posição, como o resto do layout "relatório" faz: exports diferentes do
 * mesmo relatório (visto num Centro de Custo do Itaú) vêm com uma coluna extra no meio,
 * deslocando Referência/Valor/Tipo pra direita — ler célula vazia na posição fixa fazia o
 * lançamento entrar com competência em branco, sem avisar.
 */
function acharColuna(sheet: SheetGrid, rotulo: string, fallback: number): number {
  for (const row of sheet.rows) {
    if (!row) continue;
    if (!row.some((v) => typeof v === "string" && normalizaTexto(v) === "CODIGO")) continue;
    const idx = row.findIndex((v) => typeof v === "string" && normalizaTexto(v) === rotulo);
    if (idx !== -1) return idx;
  }
  return fallback;
}

interface ParseRelatorioResult {
  linhas: MovimentoInput[];
  /** "Local de trabalho" (Centro de Custo) por matrícula, quando o arquivo traz essa coluna preenchida — usado pra completar automaticamente o cadastro de colaboradores sem Centro de Custo (ver /api/movimentos). Pega o primeiro valor não vazio encontrado por matrícula. */
  localTrabalhoPorMatricula: Map<number, string>;
}

function parseRelatorio(sheet: SheetGrid): ParseRelatorioResult {
  const colLocalTrabalho = acharColunaLocalTrabalho(sheet);
  // Offset (+2/+1/+0) é a distância entre o rótulo (geralmente mesclado sobre mais de uma
  // coluna) e o valor de fato, medida no arquivo de referência — constante entre exports mesmo
  // quando a posição absoluta muda.
  const colReferencia = acharColuna(sheet, "REFERENCIA", 13) + 2;
  const colValorCalculado = acharColuna(sheet, "VALOR CALCULADO", 17) + 1;
  const colValorInformado = acharColuna(sheet, "VALOR INFORMADO", 20) + 1;
  const colTipo = acharColuna(sheet, "TIPO", 24);
  const colUnidade = acharColuna(sheet, "UNIDADE", 27);
  const out: MovimentoInput[] = [];
  const localTrabalhoPorMatricula = new Map<number, string>();
  let matricula: number | null = null;
  let nome = "";
  // Alguns exports desse relatório não preenchem a coluna "Local de trabalho" por lançamento —
  // em vez disso, anunciam o Centro de Custo uma vez por bloco numa linha própria ("Centro de
  // Custo: 20 - GILBARCO"), igual ao cabeçalho "Empresa:" (ver extractEmpresaNome), só que
  // repetido a cada bloco de colaboradores em vez de uma vez só no topo (ver Prévia 0926 -
  // Gilbarco.xlsx — sem isso, o Centro de Custo desses colaboradores nunca é resolvido pelo
  // upload, e um colaborador que já tinha outro Ccusto cadastrado antes fica preso nele).
  let ccustoAnunciado: string | null = null;

  for (const row of sheet.rows) {
    if (!row || row.length === 0) continue;

    const labelCcusto = asString(row[0]);
    if (labelCcusto && labelCcusto.toUpperCase() === "CENTRO DE CUSTO:") {
      for (let i = 1; i < row.length; i++) {
        const v = asString(row[i]);
        const m = v?.match(CODIGO_NOME_RE);
        if (m) {
          ccustoAnunciado = m[1];
          break;
        }
      }
      continue;
    }

    // Linha de identificação do colaborador ("90103398 - CARLOS EDUARDO DE ASSIS"),
    // vale para todos os lançamentos seguintes até a próxima ocorrência (inclusive
    // após quebra de página, quando o mesmo colaborador é re-anunciado).
    const colaboradorRaw = asString(row[2]);
    if (colaboradorRaw) {
      const m = colaboradorRaw.match(MATRICULA_NOME_RE);
      if (m) {
        matricula = Number(m[1]);
        nome = m[2];
        continue;
      }
    }

    // Demais linhas (cabeçalho de página, "Empregados", subtotais, rodapé) não
    // têm código numérico válido na coluna A e são ignoradas por este filtro.
    const codigo = asNumber(row[0]);
    if (!codigo || matricula === null) continue;
    const evento = asString(row[4]);
    if (!evento) continue;

    const localTrabalho = asString(row[colLocalTrabalho]) ?? ccustoAnunciado;
    if (localTrabalho && !localTrabalhoPorMatricula.has(matricula)) {
      localTrabalhoPorMatricula.set(matricula, localTrabalho);
    }

    out.push({
      codigo,
      matricula,
      nome,
      evento,
      competencia: asString(row[colReferencia]) ?? "",
      valor: asNumber(row[colValorCalculado]),
      ref: asNumber(row[colValorInformado]),
      tipo: toTipo(asString(row[colTipo])),
      forma: asString(row[colUnidade]),
    });
  }

  return { linhas: out, localTrabalhoPorMatricula };
}

const NOMES_ABA_MOVIMENTOS = ["Movimentos (2)", "Movimentos"];

export interface ParseMovimentosResult {
  linhas: MovimentoInput[];
  /**
   * Nome do Tomador declarado no cabeçalho "Empresa:" do arquivo (só existe no layout
   * "relatório" — ver isLayoutRelatorio/extractEmpresaNome). null nos demais layouts, que não
   * têm esse cabeçalho — não dá pra vincular automaticamente nesses casos.
   */
  tomadorNomeArquivo: string | null;
  /** Ver ParseRelatorioResult.localTrabalhoPorMatricula. Mapa vazio nos demais layouts. */
  localTrabalhoPorMatricula: Map<number, string>;
}

export async function parseMovimentosFile(buffer: Buffer): Promise<ParseMovimentosResult> {
  const grid = await readWorkbookGrid(buffer);
  const sheet = grid.getSheet(NOMES_ABA_MOVIMENTOS) ?? (grid.sheetNames.length === 1 ? grid.requireSheet([grid.sheetNames[0]]) : null);
  if (!sheet) {
    throw new Error(`Nenhuma aba de Movimentos encontrada. Abas disponíveis: ${grid.sheetNames.join(", ")}`);
  }
  if (isLayoutCru(sheet)) return { linhas: parseCru(sheet), tomadorNomeArquivo: null, localTrabalhoPorMatricula: new Map() };
  if (isLayoutRelatorio(sheet)) {
    const { linhas, localTrabalhoPorMatricula } = parseRelatorio(sheet);
    return { linhas, tomadorNomeArquivo: extractEmpresaNome(sheet), localTrabalhoPorMatricula };
  }
  return { linhas: parseRico(sheet), tomadorNomeArquivo: null, localTrabalhoPorMatricula: new Map() };
}
