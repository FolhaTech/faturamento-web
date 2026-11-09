import { describe, expect, it } from "vitest";
import { camposVazios } from "../camposCompartilhados";
import { calcularRetencoes, type CcustoResumo, type ColaboradorResumo } from "./aggregate";
import { acharPreviaDoCcusto, complementarDaPrevia, deducoesDoCcusto, percentualFaturaDoCcusto, valorCobrarDoCcusto, type PreviaDoCcusto } from "./cobrancaPrevia";

const colaborador = (matricula: number, nf: number): ColaboradorResumo => ({
  matricula,
  nome: `COLAB ${matricula}`,
  despesa: nf,
  taxaAdm: 0,
  fatura: nf,
  impostos: 0,
  nf,
  rubricas: [],
});

function resumo(colaboradores: ColaboradorResumo[], competencia = "09/2026 (Prévia)"): CcustoResumo {
  const total = colaboradores.reduce((s, c) => s + c.nf, 0);
  return {
    ccustoCodigo: "25",
    ccustoNome: "SUPERMERCADO CHAMA",
    tomadorCodigo: 36,
    tomadorNome: "GRUPO CHAMA",
    tomadorGrossUp: 0.1325,
    tomadorGrossUpOperacao: "+",
    competencia,
    qtdColaboradores: colaboradores.length,
    rubricas: [],
    totalDespesas: 0,
    taxaAdministrativa: 0,
    totalFaturaSemEncargos: 0,
    encargosFatura: { pis: 0, cofins: 0, iss: 0, csll: 0, irrf: 0, total: 0 },
    totalFatura: total,
    baseRetencaoInss: total,
    retencoes: calcularRetencoes(total, total),
    valorLiquido: total,
    colaboradores,
  };
}

const tres = () => resumo([colaborador(1, 1000), colaborador(2, 2000), colaborador(3, 3000)]);

describe("percentualFaturaDoCcusto", () => {
  it("lê o percentual digitado pro centro de custo; vazio ou inválido = null", () => {
    const campos = camposVazios();
    expect(percentualFaturaDoCcusto(campos, "25")).toBeNull();
    campos.percentualFatura["25"] = "20,5";
    expect(percentualFaturaDoCcusto(campos, "25")).toBe(20.5);
    campos.percentualFatura["25"] = "abc";
    expect(percentualFaturaDoCcusto(campos, "25")).toBeNull();
  });
});

describe("Valor a cobrar da Prévia com % a deduzir do Total fatura", () => {
  it("o % sai do Total fatura: Valor a cobrar (soma por colaborador) = Total fatura − %", () => {
    const campos = camposVazios();
    campos.percentualFatura["25"] = "20";
    const r = tres();
    const deducoes = deducoesDoCcusto(r, campos, true);
    expect(deducoes.size).toBe(3);
    expect(valorCobrarDoCcusto(r, deducoes)).toBe(4800); // 6.000 − 20%
  });

  it("colaborador com % próprio usa o dele; os demais usam o do centro de custo", () => {
    const campos = camposVazios();
    campos.percentualFatura["25"] = "20";
    campos.percentual["3"] = "50";
    const r = tres();
    expect(valorCobrarDoCcusto(r, deducoesDoCcusto(r, campos, true))).toBe(800 + 1600 + 1500);
  });

  it("adiantamento por colaborador também abate", () => {
    const campos = camposVazios();
    campos.percentualFatura["25"] = "10";
    campos.adiantamento["1"] = "100";
    const r = tres();
    expect(valorCobrarDoCcusto(r, deducoesDoCcusto(r, campos, true))).toBe(900 - 100 + 1800 + 2700);
  });

  it("fora da Prévia (Folha) o % do centro de custo não vale, mesmo que exista gravado", () => {
    const campos = camposVazios();
    campos.percentualFatura["25"] = "20";
    const r = resumo([colaborador(1, 1000)], "09/2026 (Folha)");
    const deducoes = deducoesDoCcusto(r, campos, false);
    expect(deducoes.size).toBe(0);
    expect(valorCobrarDoCcusto(r, deducoes)).toBe(1000);
  });

  it("sem nenhuma dedução o Valor a cobrar é o próprio Total fatura", () => {
    const r = tres();
    expect(valorCobrarDoCcusto(r, deducoesDoCcusto(r, camposVazios(), true))).toBe(r.totalFatura);
  });
});

describe("complementarDaPrevia", () => {
  it("desconta da Folha o Valor a cobrar (soma por colaborador) da Prévia, não o Total fatura dela", () => {
    const r = complementarDaPrevia(10000, { totalFatura: 6000, valorCobrar: 4800 });
    expect(r.previaCobrar).toBe(4800);
    expect(r.complementar).toBe(5200);
  });

  it("foto antiga sem valorCobrar cai no Total fatura da Prévia (cálculo de antes)", () => {
    expect(complementarDaPrevia(10000, { totalFatura: 6000 })).toEqual({ previaCobrar: 6000, complementar: 4000 });
  });

  it("Folha menor que o cobrado na Prévia dá complementar negativo (a creditar)", () => {
    expect(complementarDaPrevia(4000, { totalFatura: 6000, valorCobrar: 4800 }).complementar).toBe(-800);
  });
});

describe("acharPreviaDoCcusto", () => {
  const previas: PreviaDoCcusto[] = [
    {
      ccustoCodigo: "CHAMA LOGISTICO - PREVIA 1026",
      totalFatura: 6000,
      valorCobrar: 3000,
      colaboradores: [
        { matricula: 1, totalFatura: 1000, valorCobrar: 500 },
        { matricula: 2, totalFatura: 2000, valorCobrar: 1000 },
        { matricula: 3, totalFatura: 3000, valorCobrar: 1500 },
      ],
    },
    { ccustoCodigo: "OUTRO", totalFatura: 900, valorCobrar: 900, colaboradores: [{ matricula: 9, totalFatura: 900, valorCobrar: 900 }] },
  ];

  it("usa a Prévia do mesmo código de centro de custo quando existe", () => {
    expect(acharPreviaDoCcusto("OUTRO", [1, 2], previas)).toBe(previas[1]);
  });

  it("centro de custo da Folha com outro nome: soma o que a Prévia cobrou dos colaboradores dele", () => {
    // Folha unificada em "CHAMA LOGISTICO" (colaboradores 1 e 2 e um novo, 4); a Prévia salva ainda tem o nome antigo.
    expect(acharPreviaDoCcusto("CHAMA LOGISTICO", [1, 2, 4], previas)).toEqual({ totalFatura: 3000, valorCobrar: 1500 });
  });

  it("nenhum colaborador do centro de custo está na Prévia: não há o que comparar", () => {
    expect(acharPreviaDoCcusto("CHAMA LOGISTICO", [7, 8], previas)).toBeNull();
    expect(acharPreviaDoCcusto("CHAMA LOGISTICO", [1], [{ ccustoCodigo: "X", totalFatura: 10 }])).toBeNull(); // foto antiga, sem detalhe por colaborador
    expect(acharPreviaDoCcusto("CHAMA LOGISTICO", [1], [])).toBeNull();
  });

  it("arredonda a soma em centavos", () => {
    const p: PreviaDoCcusto[] = [{ ccustoCodigo: "A", totalFatura: 0.3, colaboradores: [{ matricula: 1, totalFatura: 0.1, valorCobrar: 0.1 }, { matricula: 2, totalFatura: 0.2, valorCobrar: 0.2 }] }];
    expect(acharPreviaDoCcusto("B", [1, 2], p)).toEqual({ totalFatura: 0.3, valorCobrar: 0.3 });
  });
});
