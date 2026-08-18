import type { CellValue, SheetGrid } from "./grid";

/**
 * Utilitários genéricos para ler uma SheetGrid como tabela de objetos, sem
 * depender de valores de fórmula em cache (o motor de cálculo do sistema
 * recalcula tudo a partir dos valores de entrada).
 */

export function detectHeaderRow(sheet: SheetGrid, markers: string[], maxScan = 5): number {
  for (let r = 0; r < Math.min(maxScan, sheet.rows.length); r++) {
    const row = sheet.rows[r] ?? [];
    if (row.some((v) => typeof v === "string" && markers.includes(v.trim()))) {
      return r;
    }
  }
  return 0;
}

/** Mapa nome-da-coluna -> índice (0-based) a partir de uma linha de cabeçalho. */
export function headerMap(sheet: SheetGrid, headerRowIndex: number): Map<string, number> {
  const map = new Map<string, number>();
  const row = sheet.rows[headerRowIndex] ?? [];
  row.forEach((v, i) => {
    if (typeof v === "string" && v.trim()) map.set(v.trim(), i);
  });
  return map;
}

export function requireHeaders(sheetName: string, h: Map<string, number>, required: string[]): void {
  const missing = required.filter((name) => !h.has(name));
  if (missing.length > 0) {
    throw new Error(`Aba "${sheetName}": colunas obrigatórias não encontradas: ${missing.join(", ")}.`);
  }
}

export function asNumber(v: CellValue): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return 0;
    // formato BR "1.251,60" -> 1251.60; também aceita "1251.60" puro
    const brNormalized = s.replace(/\./g, "").replace(",", ".");
    const n = Number(brNormalized);
    if (Number.isFinite(n)) return n;
    const n2 = Number(s);
    return Number.isFinite(n2) ? n2 : 0;
  }
  return 0;
}

export function asString(v: CellValue): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim() || null;
}

export function asDateString(v: CellValue): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") {
    const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const [, d, mo, y] = m;
      return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    return null;
  }
  return null;
}

function rowIsBlank(row: CellValue[] | undefined): boolean {
  return !row || row.every((v) => v === null || v === undefined || v === "");
}

/**
 * Itera as linhas de dados de uma tabela (após o header), parando quando
 * encontra `stopRows` linhas totalmente vazias seguidas.
 */
export function* iterateRows(
  sheet: SheetGrid,
  headerRowIndex: number,
  stopRows = 25,
): Generator<{ rowNumber: number; get: (col: number) => CellValue }> {
  let blankStreak = 0;
  for (let r = headerRowIndex + 1; r < sheet.rows.length; r++) {
    const row = sheet.rows[r];
    if (rowIsBlank(row)) {
      blankStreak++;
      if (blankStreak >= stopRows) return;
      continue;
    }
    blankStreak = 0;
    yield { rowNumber: r + 1, get: (col: number) => row[col] ?? null };
  }
}
