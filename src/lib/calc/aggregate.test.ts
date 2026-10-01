import { describe, expect, it } from "vitest";
import { aggregateByCcusto } from "./aggregate";
import type { CalculatedLine } from "./engine";

const COMP = "09/2026 (Folha)";

/** Linha mínima com Gross Up "+" de 13,25%: NF = fatura × 1,1325, tributação = NF − fatura. */
function linha(matricula: number, fatura: number): CalculatedLine {
  const nf = fatura * 1.1325;
  return {
    matricula,
    nome: `COLAB ${matricula}`,
    codigo: 1,
    evento: "DIAS NORMAIS",
    competencia: COMP,
    tipo: "P",
    tomadorCodigo: 1,
    tomadorNome: "TOMADOR",
    fpas: 515,
    tomadorGrossUp: 0.1325,
    tomadorGrossUpOperacao: "+",
    ccustoCodigo: "1",
    ccustoNome: "CC",
    trilha: "encargos",
    dre: fatura,
    inss: 0,
    fgts: 0,
    provFerias: 0,
    prov13: 0,
    encInss: 0,
    encFgts: 0,
    base: fatura,
    taxaAdmValor: 0,
    fatura,
    impostos: nf - fatura,
    nf,
  } as CalculatedLine;
}

describe("aggregateByCcusto — encargos dos tributos", () => {
  it("o total de Encargos do card é igual à soma da coluna Tributação dos colaboradores", () => {
    const [resumo] = aggregateByCcusto([linha(1, 30000), linha(2, 11056.23)], COMP);
    const tributacao = resumo.colaboradores.reduce((soma, c) => soma + c.impostos, 0);

    expect(resumo.encargosFatura.total).toBeCloseTo(tributacao, 6);
    expect(resumo.totalFaturaSemEncargos + resumo.encargosFatura.total).toBeCloseTo(resumo.totalFatura, 6);
  });

  it("a soma dos cinco tributos fecha com o total de Encargos", () => {
    const [resumo] = aggregateByCcusto([linha(1, 41056.23)], COMP);
    const { pis, cofins, iss, csll, irrf, total } = resumo.encargosFatura;

    expect(pis + cofins + iss + csll + irrf).toBeCloseTo(total, 6);
    expect(total).toBeCloseTo(41056.23 * 0.1325, 6);
  });
});
