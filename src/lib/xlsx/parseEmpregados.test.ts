import { describe, expect, it } from "vitest";
import type { SheetGrid } from "./grid";
import { parseVinculosDaAba } from "./parseEmpregados";

const CABECALHO = ["Cód Emp", "Cód Epr", "Nome", "Admissão", "Data Demissão", "Motivo Demissão"];
const aba = (linhas: (string | number | null)[][]): SheetGrid => ({ name: "Empregados em Excel", rows: [CABECALHO, ...linhas] });

describe("parseVinculosDaAba", () => {
  it("lê matrícula (Cód Epr), admissão, demissão e motivo, convertendo datas dd/mm/aaaa para AAAA-MM-DD", () => {
    const r = parseVinculosDaAba(
      aba([
        ["4", "90103375", "LUCAS", "05/01/2026", "08/09/2026", "Término do contrato de trabalho por tempo determinado"],
        ["4", 90103544, "RAQUEL", "03/09/2026", null, null],
      ]),
    );
    expect(r.vinculos).toEqual([
      { matricula: 90103375, admissao: "2026-01-05", dataDemissao: "2026-09-08", motivoDemissao: "Término do contrato de trabalho por tempo determinado" },
      { matricula: 90103544, admissao: "2026-09-03", dataDemissao: null, motivoDemissao: null },
    ]);
    expect(r.linhasIgnoradas).toBe(0);
  });

  it("ignora linhas sem matrícula válida e conta matrículas repetidas (vale a última)", () => {
    const r = parseVinculosDaAba(
      aba([
        ["4", "", "SEM MATRICULA", "01/01/2020", null, null],
        ["4", "123", "A", "01/01/2020", null, null],
        ["4", "123", "A DE NOVO", "02/02/2021", "03/03/2022", "Demitido SEM justa causa"],
      ]),
    );
    expect(r.linhasIgnoradas).toBe(1);
    expect(r.duplicadas).toBe(1);
    expect(r.vinculos).toEqual([{ matricula: 123, admissao: "2021-02-02", dataDemissao: "2022-03-03", motivoDemissao: "Demitido SEM justa causa" }]);
  });

  it("falha com mensagem clara quando não é a planilha de Empregados", () => {
    expect(() => parseVinculosDaAba({ name: "x", rows: [["Código", "Nome"], ["1", "A"]] })).toThrow(/Colunas não encontradas/);
  });
});
