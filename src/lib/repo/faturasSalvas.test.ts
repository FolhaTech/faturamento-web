import { beforeEach, describe, expect, it } from "vitest";
import type { CalculatedLine } from "../calc/engine";
import { resetDbForTests } from "../db";
import { descartarFaturaSalva, getFaturaSalva, listCompetenciasComFaturaSalva, salvarFatura } from "./faturasSalvas";
import { replaceMovimentosPorCompetencia, type MovimentoInput } from "./movimentos";

beforeEach(async () => {
  await resetDbForTests();
});

function linha(overrides: Partial<CalculatedLine> = {}): CalculatedLine {
  return {
    matricula: 1,
    nome: "FULANO",
    codigo: 8781,
    evento: "DIAS NORMAIS",
    competencia: "01/2026",
    tipo: "P",
    tomadorCodigo: 1,
    tomadorNome: "TOMADOR TESTE",
    fpas: 515,
    tomadorGrossUp: 0.1325,
    tomadorGrossUpOperacao: "+",
    ccustoCodigo: "10",
    ccustoNome: "OBRA 10",
    trilha: "encargos",
    dre: 1000,
    inss: 288,
    fgts: 80,
    provFerias: 111.11,
    prov13: 83.33,
    encInss: 55.99,
    encFgts: 15.55,
    base: 1633.98,
    taxaAdmValor: 163.4,
    fatura: 1797.38,
    impostos: 238.16,
    nf: 2035.54,
    ...overrides,
  };
}

describe("faturasSalvas repo — foto congelada do faturamento por competência", () => {
  it("getFaturaSalva retorna null quando a competência ainda não foi salva", async () => {
    expect(await getFaturaSalva("01/2026")).toBeNull();
  });

  it("salva e lê de volta as lines e warnings sem perder dados no round-trip JSON", async () => {
    const lines = [linha(), linha({ matricula: 2, evento: "HORAS EXTRAS 50%", nf: 42.5 })];
    const warnings = ["aviso 1", "aviso 2"];

    await salvarFatura("01/2026", lines, warnings);
    const salva = await getFaturaSalva("01/2026");

    expect(salva).not.toBeNull();
    expect(salva!.lines).toHaveLength(2);
    expect(salva!.lines[1].evento).toBe("HORAS EXTRAS 50%");
    expect(salva!.lines[1].nf).toBeCloseTo(42.5, 6);
    expect(salva!.warnings).toEqual(warnings);
    expect(new Date(salva!.salvoEm).getTime()).not.toBeNaN();
  });

  it("salvar de novo pra mesma competência substitui (não duplica) e atualiza salvo_em", async () => {
    await salvarFatura("01/2026", [linha()], []);
    const primeira = await getFaturaSalva("01/2026");

    await new Promise((r) => setTimeout(r, 5));
    await salvarFatura("01/2026", [linha(), linha({ matricula: 2 })], ["novo aviso"]);
    const segunda = await getFaturaSalva("01/2026");

    expect(segunda!.lines).toHaveLength(2);
    expect(segunda!.warnings).toEqual(["novo aviso"]);
    expect(new Date(segunda!.salvoEm).getTime()).toBeGreaterThanOrEqual(new Date(primeira!.salvoEm).getTime());
  });

  it("descartarFaturaSalva remove a foto — volta a não ter nada salvo", async () => {
    await salvarFatura("01/2026", [linha()], []);
    await descartarFaturaSalva("01/2026");
    expect(await getFaturaSalva("01/2026")).toBeNull();
  });

  it("listCompetenciasComFaturaSalva só retorna as que têm foto salva", async () => {
    await salvarFatura("01/2026", [linha()], []);
    const resultado = await listCompetenciasComFaturaSalva(["01/2026", "02/2026"]);
    expect(resultado.has("01/2026")).toBe(true);
    expect(resultado.has("02/2026")).toBe(false);
  });

  it("reenviar o arquivo de Movimentos daquela competência apaga a fatura salva — dados de origem mudaram", async () => {
    const mov: MovimentoInput = {
      codigo: 8781,
      matricula: 1,
      nome: "FULANO",
      evento: "DIAS NORMAIS",
      competencia: "01/2026",
      valor: 1000,
      ref: 30,
      tipo: "P",
      forma: "Dias",
    };
    await replaceMovimentosPorCompetencia([mov]);
    await salvarFatura("01/2026", [linha()], []);
    expect(await getFaturaSalva("01/2026")).not.toBeNull();

    // Reenvio: substitui as linhas de Movimentos da mesma competência.
    await replaceMovimentosPorCompetencia([mov]);
    expect(await getFaturaSalva("01/2026")).toBeNull();
  });

  it("reenviar Movimentos de OUTRA competência não mexe na fatura salva desta", async () => {
    await salvarFatura("01/2026", [linha()], []);
    await replaceMovimentosPorCompetencia([
      {
        codigo: 8781,
        matricula: 1,
        nome: "FULANO",
        evento: "DIAS NORMAIS",
        competencia: "02/2026",
        valor: 1000,
        ref: 30,
        tipo: "P",
        forma: "Dias",
      },
    ]);
    expect(await getFaturaSalva("01/2026")).not.toBeNull();
  });
});
