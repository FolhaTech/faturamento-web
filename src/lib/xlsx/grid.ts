import * as XLSX from "xlsx";
import { lerAbasBiff8 } from "./biffFallback";

/**
 * Leitura de planilhas desacoplada da biblioteca subjacente: os arquivos que
 * chegam variam (.xlsx moderno com tabelas nomeadas, .xls legado exportado
 * direto do sistema de folha, com ou sem cabeçalho). O SheetJS lê os dois
 * formatos de forma uniforme; a partir daqui tudo trabalha em cima de uma
 * grade simples de valores (linhas x colunas, 0-indexado).
 */

export type CellValue = string | number | Date | boolean | null;

export interface SheetGrid {
  name: string;
  rows: CellValue[][];
}

export interface WorkbookGrid {
  sheetNames: string[];
  getSheet(names: string[]): SheetGrid | null;
  requireSheet(names: string[]): SheetGrid;
}

export async function readWorkbookGrid(buffer: Buffer): Promise<WorkbookGrid> {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });

  // .xls com o ponteiro da aba quebrado (ex.: "Empregados em Excel" do sistema de folha): a biblioteca devolve o
  // nome da aba sem nenhuma célula — nesse caso lê pelo leitor de reserva (ver biffFallback.ts), na mesma ordem.
  const semConteudo = wb.SheetNames.some((n) => !wb.Sheets[n]);
  const abasDeReserva = semConteudo ? lerAbasBiff8(buffer) : null;

  const sheets = new Map<string, SheetGrid>();
  wb.SheetNames.forEach((name, i) => {
    const ws = wb.Sheets[name];
    if (!ws) {
      sheets.set(name, { name, rows: abasDeReserva?.[i] ?? [] });
      return;
    }
    const rows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: true,
      defval: null,
    }) as CellValue[][];
    sheets.set(name, { name, rows });
  });

  const getSheet = (names: string[]): SheetGrid | null => {
    for (const n of names) {
      const found = sheets.get(n);
      if (found) return found;
    }
    return null;
  };

  const requireSheet = (names: string[]): SheetGrid => {
    const found = getSheet(names);
    if (!found) {
      throw new Error(
        `Nenhuma aba encontrada com os nomes: ${names.join(", ")}. Abas disponíveis: ${wb.SheetNames.join(", ")}`,
      );
    }
    return found;
  };

  return { sheetNames: wb.SheetNames, getSheet, requireSheet };
}
