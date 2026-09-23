import { describe, expect, it } from "vitest";
import type { CalculatedLine } from "./engine";
import { chaveEventoExcluido } from "../repo/eventosExcluidos";
import { filtrarEventosExcluidos } from "./eventosExcluidos";

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

describe("filtrarEventosExcluidos — remove eventos excluídos manualmente por colaborador", () => {
  it("sem exclusões, não mexe nas linhas", () => {
    const lines = [linha(), linha({ matricula: 2, evento: "HORAS EXTRAS 50%" })];
    expect(filtrarEventosExcluidos(lines, new Set())).toBe(lines);
  });

  it("remove só as linhas do evento excluído desse colaborador, não dos demais", () => {
    const lines = [
      linha({ matricula: 1, evento: "HORAS EXTRAS 50%" }),
      linha({ matricula: 2, evento: "HORAS EXTRAS 50%" }),
      linha({ matricula: 1, evento: "DIAS NORMAIS" }),
    ];
    const excluidos = new Set([chaveEventoExcluido(1, "HORAS EXTRAS 50%")]);

    const resultado = filtrarEventosExcluidos(lines, excluidos);
    expect(resultado).toHaveLength(2);
    expect(resultado.some((l) => l.matricula === 2 && l.evento === "HORAS EXTRAS 50%")).toBe(true);
    expect(resultado.some((l) => l.matricula === 1 && l.evento === "DIAS NORMAIS")).toBe(true);
  });

  it("não afeta o mesmo evento de outro colaborador, mesmo no mesmo Centro de Custo", () => {
    const lines = [linha({ matricula: 1, evento: "HORAS EXTRAS 50%" }), linha({ matricula: 2, evento: "HORAS EXTRAS 50%" })];
    const excluidos = new Set([chaveEventoExcluido(1, "HORAS EXTRAS 50%")]);

    const resultado = filtrarEventosExcluidos(lines, excluidos);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].matricula).toBe(2);
  });
});
