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

const NOMES_ABA_MOVIMENTOS = ["Movimentos (2)", "Movimentos"];

export async function parseMovimentosFile(buffer: Buffer): Promise<MovimentoInput[]> {
  const grid = await readWorkbookGrid(buffer);
  const sheet = grid.getSheet(NOMES_ABA_MOVIMENTOS) ?? (grid.sheetNames.length === 1 ? grid.requireSheet([grid.sheetNames[0]]) : null);
  if (!sheet) {
    throw new Error(`Nenhuma aba de Movimentos encontrada. Abas disponíveis: ${grid.sheetNames.join(", ")}`);
  }
  return isLayoutCru(sheet) ? parseCru(sheet) : parseRico(sheet);
}
