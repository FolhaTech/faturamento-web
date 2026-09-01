import type { MovimentoInput } from "../repo/movimentos";
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
 * Empregado:", "Total da empresa:") intercaladas. Colunas fixas por posição:
 * A(0) Código, E(4) Nome do evento, P(15) Referência/Comp, S(18) Valor
 * calculado, V(21) Valor informado, Y(24) Tipo, AB(27) Unidade.
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

function parseRelatorio(sheet: SheetGrid): MovimentoInput[] {
  const out: MovimentoInput[] = [];
  let matricula: number | null = null;
  let nome = "";

  for (const row of sheet.rows) {
    if (!row || row.length === 0) continue;

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

    out.push({
      codigo,
      matricula,
      nome,
      evento,
      competencia: asString(row[15]) ?? "",
      valor: asNumber(row[18]),
      ref: asNumber(row[21]),
      tipo: toTipo(asString(row[24])),
      forma: asString(row[27]),
    });
  }

  return out;
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
}

export async function parseMovimentosFile(buffer: Buffer): Promise<ParseMovimentosResult> {
  const grid = await readWorkbookGrid(buffer);
  const sheet = grid.getSheet(NOMES_ABA_MOVIMENTOS) ?? (grid.sheetNames.length === 1 ? grid.requireSheet([grid.sheetNames[0]]) : null);
  if (!sheet) {
    throw new Error(`Nenhuma aba de Movimentos encontrada. Abas disponíveis: ${grid.sheetNames.join(", ")}`);
  }
  if (isLayoutCru(sheet)) return { linhas: parseCru(sheet), tomadorNomeArquivo: null };
  if (isLayoutRelatorio(sheet)) return { linhas: parseRelatorio(sheet), tomadorNomeArquivo: extractEmpresaNome(sheet) };
  return { linhas: parseRico(sheet), tomadorNomeArquivo: null };
}
