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

  /** Monta uma linha de N colunas com valores em posições específicas (índice 0-based) — evita contar vírgulas à mão como as linhas literais acima. */
  function linhaPorPosicao(valores: Record<number, unknown>, largura = 32): unknown[] {
    const row = new Array(largura).fill(null);
    for (const [i, v] of Object.entries(valores)) row[Number(i)] = v;
    return row;
  }

  it("acha Referência/Valor/Tipo pelo texto do cabeçalho mesmo com uma coluna a mais deslocando tudo pra direita (caso real: export do Itaú Impressões)", async () => {
    const buffer = bufferFromRows("Movimentos", [
      ["Empresa:", null, null, null, null, null, "4 - GENTER SERVICOS EM RECURSOS HUMANOS LTDA"],
      ["CNPJ:", null, null, null, null, null, "13.173.017/0001-92"],
      ["Competência:", null, null, null, null, null, "09/2026"],
      // cabeçalho 1 coluna à direita do "de referência" (Referência em 14, não 13; Valor
      // calculado em 18, não 17; etc.) — mesmo padrão observado no arquivo real do Itaú.
      linhaPorPosicao({ 0: "Código", 4: "Nome", 14: "Referência", 18: "Valor calculado", 21: "Valor informado", 25: "Tipo", 28: "Unidade" }),
      linhaPorPosicao({ 2: "90103362 - ALISON FERNANDES SANTOS" }, 3),
      linhaPorPosicao({ 0: 8781, 4: "DIAS NORMAIS", 16: "09/2026", 19: 2232.53, 22: 30, 25: "P", 28: "Dias" }),
    ]);

    const { linhas } = await parseMovimentosFile(buffer);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      matricula: 90103362,
      nome: "ALISON FERNANDES SANTOS",
      evento: "DIAS NORMAIS",
      competencia: "09/2026", // antes do fix, lia a posição fixa (vazia aqui) e vinha ""
      valor: 2232.53,
      ref: 30,
      tipo: "P",
      forma: "Dias",
    });
  });

  it("extrai o Centro de Custo ('Local de trabalho') por matrícula, achando a coluna pelo cabeçalho", async () => {
    const buffer = bufferFromRows("Movimentos", [
      ["Empresa:", null, null, null, null, null, "4 - GENTER SERVICOS EM RECURSOS HUMANOS LTDA"],
      ["CNPJ:", null, null, null, null, null, "13.173.017/0001-92"],
      ["Competência:", null, null, null, null, null, "08/2026"],
      // cabeçalho de colunas real (repete a cada página) — "Local de trabalho" na coluna AD(29).
      [
        "Código", null, null, null, "Nome", null, null, null, null, null, null, null, null, "Referência", null, null, null,
        "Valor calculado", null, null, "Valor informado", null, null, null, "Tipo", null, null, "Unidade", null, "Local de trabalho",
      ],
      [null, null, "90103398 - CARLOS EDUARDO DE ASSIS"],
      [
        8781, null, null, null, "DIAS NORMAIS", null, null, null, null, null, null, null, null, null, null, "08/2026", null, null,
        1000, null, null, 30, null, null, "P", null, null, "Dias", null, "HOSPITAL SAO LUCAS",
      ],
    ]);

    const { localTrabalhoPorMatricula } = await parseMovimentosFile(buffer);
    expect(localTrabalhoPorMatricula.get(90103398)).toBe("HOSPITAL SAO LUCAS");
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
