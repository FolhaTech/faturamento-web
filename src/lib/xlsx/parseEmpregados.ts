import { readWorkbookGrid, type SheetGrid } from "./grid";
import { asDateString, asString, detectHeaderRow, headerMap } from "./readTable";

/** Admissão e rescisão de um colaborador, como vêm da planilha "Empregados em Excel" do sistema de folha. */
export interface VinculoEmpregado {
  matricula: number;
  /** Data de admissão (AAAA-MM-DD) — null quando a linha não traz. */
  admissao: string | null;
  /** Data de demissão/rescisão (AAAA-MM-DD) — null = sem demissão na planilha. */
  dataDemissao: string | null;
  /** Motivo da demissão, como escrito na planilha. */
  motivoDemissao: string | null;
}

export interface ResultadoParseEmpregados {
  vinculos: VinculoEmpregado[];
  /** Linhas ignoradas (sem Cód Epr válido) — só pra informar no resumo do upload. */
  linhasIgnoradas: number;
  /** Matrículas repetidas na planilha: vale a última linha. */
  duplicadas: number;
}

const COLUNAS = {
  matricula: "Cód Epr",
  admissao: "Admissão",
  dataDemissao: "Data Demissão",
  motivoDemissao: "Motivo Demissão",
} as const;

function lerMatricula(valor: unknown): number | null {
  const n = typeof valor === "number" ? valor : Number(String(valor ?? "").replace(/\D/g, ""));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Lê as colunas Cód Epr (matrícula), Admissão, Data Demissão e Motivo Demissão de uma aba de "Empregados em Excel". */
export function parseVinculosDaAba(sheet: SheetGrid): ResultadoParseEmpregados {
  const linhaCabecalho = detectHeaderRow(sheet, [COLUNAS.matricula]);
  const h = headerMap(sheet, linhaCabecalho);
  const faltando = Object.values(COLUNAS).filter((c) => !h.has(c));
  if (faltando.length > 0) {
    throw new Error(`Colunas não encontradas na planilha: ${faltando.join(", ")}. Envie o arquivo "Empregados em Excel" exportado do sistema de folha.`);
  }

  const porMatricula = new Map<number, VinculoEmpregado>();
  let linhasIgnoradas = 0;
  let duplicadas = 0;
  for (let r = linhaCabecalho + 1; r < sheet.rows.length; r++) {
    const linha = sheet.rows[r] ?? [];
    if (linha.every((v) => v === null || v === undefined || v === "")) continue;
    const matricula = lerMatricula(linha[h.get(COLUNAS.matricula)!]);
    if (matricula === null) {
      linhasIgnoradas++;
      continue;
    }
    if (porMatricula.has(matricula)) duplicadas++;
    porMatricula.set(matricula, {
      matricula,
      admissao: asDateString(linha[h.get(COLUNAS.admissao)!] ?? null),
      dataDemissao: asDateString(linha[h.get(COLUNAS.dataDemissao)!] ?? null),
      motivoDemissao: asString(linha[h.get(COLUNAS.motivoDemissao)!] ?? null),
    });
  }
  return { vinculos: [...porMatricula.values()], linhasIgnoradas, duplicadas };
}

export async function parseEmpregadosFile(buffer: Buffer): Promise<ResultadoParseEmpregados> {
  const grid = await readWorkbookGrid(buffer);
  const sheet = grid.getSheet(["Empregados em Excel"]) ?? (grid.sheetNames.length === 1 ? grid.requireSheet([grid.sheetNames[0]]) : null);
  if (!sheet) throw new Error(`Aba "Empregados em Excel" não encontrada. Abas disponíveis: ${grid.sheetNames.join(", ")}`);
  return parseVinculosDaAba(sheet);
}
