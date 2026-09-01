import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { parseMovimentosFile } from "./parseMovimentos";

function bufferFromRows(sheetName: string, rows: unknown[][]): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parseMovimentosFile — layout 'relatório' (exportação paginada)", () => {
  it("extrai o nome do Tomador do cabeçalho 'Empresa:', ignorando o código do sistema de origem", async () => {
    const buffer = bufferFromRows("Movimentos", [
      ["Empresa:", null, null, null, null, null, "4 - GENTER SERVICOS EM RECURSOS HUMANOS LTDA"],
      ["CNPJ:", null, null, null, null, null, "13.173.017/0001-92"],
      ["Competência:", null, null, null, null, null, "08/2026"],
      [null, null, "90103507 - EDUARDA CAROLINE OKAMURA"],
      // colunas: A(0) Código, E(4) Evento, P(15) Comp, S(18) Valor, V(21) Ref, Y(24) Tipo, AB(27) Fórma — ver parseRelatorio.
      [8781, null, null, null, "DIAS NORMAIS", null, null, null, null, null, null, null, null, null, null, "08/2026", null, null, 1000, null, null, 30, null, null, "P", null, null, "Dias"],
    ]);

    const { linhas, tomadorNomeArquivo } = await parseMovimentosFile(buffer);
    expect(tomadorNomeArquivo).toBe("GENTER SERVICOS EM RECURSOS HUMANOS LTDA");
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ matricula: 90103507, nome: "EDUARDA CAROLINE OKAMURA", evento: "DIAS NORMAIS" });
  });
});

describe("parseMovimentosFile — layout 'rico' (planilha-modelo com cabeçalho textual)", () => {
  it("não tem cabeçalho de Empresa — tomadorNomeArquivo vem null", async () => {
    const buffer = bufferFromRows("Movimentos", [
      ["Código", "Matrícula", "Nome", "Evento", "Comp", "Valor", "Ref", "Tipo", "Fórma"],
      [8781, 90103392, "ADALBERTO ALVARES JUNIOR", "DIAS NORMAIS", "01/2026", 1000, 30, "P", "Dias"],
    ]);

    const { linhas, tomadorNomeArquivo } = await parseMovimentosFile(buffer);
    expect(tomadorNomeArquivo).toBeNull();
    expect(linhas).toHaveLength(1);
  });
});
