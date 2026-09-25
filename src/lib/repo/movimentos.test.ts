import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "../db";
import {
  countMovimentosPorCompetenciaEMatriculas,
  listMovimentosByCompetencia,
  replaceMovimentosPorCompetencia,
  type MovimentoInput,
} from "./movimentos";

beforeEach(async () => {
  await resetDbForTests();
});

function mov(overrides: Partial<MovimentoInput> = {}): MovimentoInput {
  return {
    codigo: 8781,
    matricula: 1,
    nome: "FULANO",
    evento: "DIAS NORMAIS",
    competencia: "01/2026",
    valor: 1000,
    ref: 30,
    tipo: "P",
    forma: "Dias",
    ...overrides,
  };
}

describe("replaceMovimentosPorCompetencia — substitui só as matrículas do arquivo novo, não a competência inteira", () => {
  it("subir o arquivo de um cliente novo não apaga os lançamentos de outro cliente já importado na mesma competência", async () => {
    await replaceMovimentosPorCompetencia([mov({ matricula: 1, nome: "CLIENTE A" })]);
    await replaceMovimentosPorCompetencia([mov({ matricula: 2, nome: "CLIENTE B" })]);

    const lancamentos = await listMovimentosByCompetencia("01/2026");
    expect(lancamentos).toHaveLength(2);
    expect(lancamentos.map((l) => l.matricula).sort()).toEqual([1, 2]);
  });

  it("reenviar o arquivo da MESMA matrícula substitui só os lançamentos dela (não duplica)", async () => {
    await replaceMovimentosPorCompetencia([mov({ matricula: 1, evento: "DIAS NORMAIS", valor: 1000 })]);
    await replaceMovimentosPorCompetencia([mov({ matricula: 2, evento: "DIAS NORMAIS", valor: 500 })]);

    // Reenvio corrigido da matrícula 1 — não deve mexer na matrícula 2.
    await replaceMovimentosPorCompetencia([mov({ matricula: 1, evento: "DIAS NORMAIS", valor: 1234.56 })]);

    const lancamentos = await listMovimentosByCompetencia("01/2026");
    expect(lancamentos).toHaveLength(2);
    const daMatricula1 = lancamentos.find((l) => l.matricula === 1);
    expect(daMatricula1!.valor).toBe(1234.56);
    const daMatricula2 = lancamentos.find((l) => l.matricula === 2);
    expect(daMatricula2!.valor).toBe(500);
  });

  it("um arquivo com várias linhas da mesma matrícula substitui todas elas juntas", async () => {
    await replaceMovimentosPorCompetencia([
      mov({ matricula: 1, evento: "DIAS NORMAIS" }),
      mov({ matricula: 1, evento: "HORAS EXTRAS 50%" }),
    ]);
    await replaceMovimentosPorCompetencia([mov({ matricula: 1, evento: "DIAS NORMAIS" })]);

    const lancamentos = await listMovimentosByCompetencia("01/2026");
    expect(lancamentos).toHaveLength(1);
    expect(lancamentos[0].evento).toBe("DIAS NORMAIS");
  });

  it("countMovimentosPorCompetenciaEMatriculas só conta as matrículas dadas, não a competência inteira", async () => {
    await replaceMovimentosPorCompetencia([mov({ matricula: 1 }), mov({ matricula: 2 })]);

    const contagens = await countMovimentosPorCompetenciaEMatriculas([{ competencia: "01/2026", matriculas: [2] }]);
    expect(contagens.get("01/2026")).toBe(1);
  });

  it("countMovimentosPorCompetenciaEMatriculas retorna 0 quando nenhuma das matrículas dadas tem lançamento (cliente novo, sem risco de substituir nada)", async () => {
    await replaceMovimentosPorCompetencia([mov({ matricula: 1 })]);

    const contagens = await countMovimentosPorCompetenciaEMatriculas([{ competencia: "01/2026", matriculas: [999] }]);
    expect(contagens.get("01/2026")).toBe(0);
  });
});
