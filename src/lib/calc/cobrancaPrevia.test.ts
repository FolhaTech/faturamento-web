import { describe, expect, it } from "vitest";
import { camposVazios } from "../camposCompartilhados";
import { calcularRetencoes, type CcustoResumo, type ColaboradorResumo } from "./aggregate";
import { casarPreviasComCcustos, complementarDaPrevia, deducoesDoCcusto, percentualFaturaDoCcusto, valorCobrarDoCcusto, type PreviaDoCcusto } from "./cobrancaPrevia";

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

describe("casarPreviasComCcustos", () => {
  const previaChama: PreviaDoCcusto = {
    ccustoCodigo: "CHAMA LOGISTICO - PREVIA 1026",
    totalFatura: 6000,
    valorCobrar: 3000,
    colaboradores: [
      { matricula: 1, totalFatura: 1000, valorCobrar: 500 },
      { matricula: 2, totalFatura: 2000, valorCobrar: 1000 },
      { matricula: 3, totalFatura: 3000, valorCobrar: 1500 },
    ],
  };
  const outra: PreviaDoCcusto = { ccustoCodigo: "OUTRO", totalFatura: 900, valorCobrar: 900, colaboradores: [{ matricula: 9, totalFatura: 900, valorCobrar: 900 }] };

  it("usa a Prévia do mesmo código de centro de custo quando existe", () => {
    const r = casarPreviasComCcustos([{ ccustoCodigo: "OUTRO", matriculas: [9] }], [previaChama, outra]);
    expect(r.get("OUTRO")).toBe(outra);
  });

  it("Prévia de outro nome cujos colaboradores estão num centro da Folha que já casou por código soma nele", () => {
    // Folha "OUTRO" casa por código com a Prévia "OUTRO" (colaborador 9) e também tem os colaboradores 1 e 2, que a Prévia cobrou noutro centro.
    const r = casarPreviasComCcustos([{ ccustoCodigo: "OUTRO", matriculas: [9, 1, 2] }], [previaChama, outra]);
    expect(r.get("OUTRO")).toEqual({ totalFatura: 6900, valorCobrar: 3900 });
  });

  it("centro de custo da Folha com outro nome recebe a Prévia INTEIRA, inclusive colaboradores que estão noutro centro da Folha", () => {
    // Folha: "FOLHA 1026" com os colaboradores 1 e 2 (+ um novo, 4) e "ADIANTAMENTO" com o 3. A Prévia cobrou os três juntos.
    const r = casarPreviasComCcustos(
      [
        { ccustoCodigo: "CHAMA LOGISTICO - FOLHA 1026", matriculas: [1, 2, 4] },
        { ccustoCodigo: "CHAMA LOGISTICO - ADIANTAMENTO 102026", matriculas: [3] },
      ],
      [previaChama],
    );
    expect(r.get("CHAMA LOGISTICO - FOLHA 1026")).toEqual({ totalFatura: 6000, valorCobrar: 3000 });
    // A Prévia vai pra um centro só: o outro não desconta de novo.
    expect(r.has("CHAMA LOGISTICO - ADIANTAMENTO 102026")).toBe(false);
  });

  it("o caso do CHAMA LOGISTICO: 41 na Folha e 2 no Adiantamento, Prévia de R$ 75.639,97 (50% de 151.279,94) dos 43", () => {
    const colaboradores = Array.from({ length: 43 }, (_, i) => ({ matricula: 100 + i, totalFatura: 151279.94 / 43, valorCobrar: 75639.97 / 43 }));
    const previa: PreviaDoCcusto = { ccustoCodigo: "CHAMA LOGISTICO - PREVIA", totalFatura: 151279.94, valorCobrar: 75639.97, colaboradores };
    const r = casarPreviasComCcustos(
      [
        { ccustoCodigo: "CHAMA LOGISTICO - FOLHA 1026", matriculas: colaboradores.slice(0, 41).map((c) => c.matricula) },
        { ccustoCodigo: "CHAMA LOGISTICO - ADIANTAMENTO 102026", matriculas: colaboradores.slice(41).map((c) => c.matricula) },
      ],
      [previa],
    );
    expect(r.get("CHAMA LOGISTICO - FOLHA 1026")?.valorCobrar).toBe(75639.97);
  });

  it("duas Prévias que sobraram, uma pra cada centro da Folha, cada uma vai pro seu", () => {
    const r = casarPreviasComCcustos(
      [
        { ccustoCodigo: "A", matriculas: [1, 2, 3] },
        { ccustoCodigo: "B", matriculas: [9] },
      ],
      [previaChama, outra],
    );
    expect(r.get("A")).toEqual({ totalFatura: 6000, valorCobrar: 3000 });
    expect(r.get("B")).toEqual({ totalFatura: 900, valorCobrar: 900 });
  });

  it("duas Prévias que casam com o mesmo centro da Folha somam", () => {
    const p2: PreviaDoCcusto = { ccustoCodigo: "P2", totalFatura: 400, valorCobrar: 200, colaboradores: [{ matricula: 5, totalFatura: 400, valorCobrar: 200 }] };
    const r = casarPreviasComCcustos([{ ccustoCodigo: "A", matriculas: [1, 2, 3, 5] }], [previaChama, p2]);
    expect(r.get("A")).toEqual({ totalFatura: 6400, valorCobrar: 3200 });
  });

  it("empate de colaboradores em comum: fica com o centro da Folha maior", () => {
    const r = casarPreviasComCcustos(
      [
        { ccustoCodigo: "PEQUENO", matriculas: [1] },
        { ccustoCodigo: "GRANDE", matriculas: [2, 7, 8, 9] },
      ],
      [{ ...previaChama, colaboradores: [previaChama.colaboradores![0], previaChama.colaboradores![1]] }],
    );
    expect(r.has("GRANDE")).toBe(true);
    expect(r.has("PEQUENO")).toBe(false);
  });

  it("sem colaboradores em comum, ou foto antiga sem detalhe por colaborador, não há o que comparar", () => {
    expect(casarPreviasComCcustos([{ ccustoCodigo: "CHAMA LOGISTICO", matriculas: [7, 8] }], [previaChama]).size).toBe(0);
    expect(casarPreviasComCcustos([{ ccustoCodigo: "CHAMA LOGISTICO", matriculas: [1] }], [{ ccustoCodigo: "X", totalFatura: 10 }]).size).toBe(0);
    expect(casarPreviasComCcustos([{ ccustoCodigo: "CHAMA LOGISTICO", matriculas: [1] }], []).size).toBe(0);
  });

  it("foto antiga sem valor a cobrar soma pelo Total fatura", () => {
    const p: PreviaDoCcusto = { ccustoCodigo: "X", totalFatura: 100, colaboradores: [{ matricula: 1, totalFatura: 100, valorCobrar: 100 }] };
    expect(casarPreviasComCcustos([{ ccustoCodigo: "A", matriculas: [1] }], [p]).get("A")).toEqual({ totalFatura: 100, valorCobrar: 100 });
  });
});
