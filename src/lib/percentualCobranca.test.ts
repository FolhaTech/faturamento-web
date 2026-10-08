import { describe, expect, it } from "vitest";
import {
  adiantamentoAtivo,
  calcularCobranca,
  juntarDeducoes,
  lerAdiantamentosSerializados,
  lerPercentual,
  lerPercentuaisSerializados,
  lerValorReais,
  percentualAtivo,
  serializarAdiantamentos,
  serializarPercentuais,
  somarCobranca,
  valorDoPercentual,
} from "./percentualCobranca";

describe("lerPercentual", () => {
  it("aceita vírgula, ponto e o símbolo %", () => {
    expect(lerPercentual("20")).toBe(20);
    expect(lerPercentual("20,5")).toBe(20.5);
    expect(lerPercentual("20.5")).toBe(20.5);
    expect(lerPercentual(" 12,25 % ")).toBe(12.25);
    expect(lerPercentual("0")).toBe(0);
    expect(lerPercentual("100")).toBe(100);
  });

  it("rejeita vazio, texto, negativo e acima de 100%", () => {
    expect(lerPercentual("")).toBeNull();
    expect(lerPercentual("abc")).toBeNull();
    expect(lerPercentual("-5")).toBeNull();
    expect(lerPercentual("101")).toBeNull();
  });
});

describe("percentualAtivo", () => {
  it("0% e vazio são 'sem dedução'", () => {
    expect(percentualAtivo("0")).toBeNull();
    expect(percentualAtivo("0,0")).toBeNull();
    expect(percentualAtivo("")).toBeNull();
    expect(percentualAtivo("20")).toBe(20);
  });
});

describe("valorDoPercentual", () => {
  it("calcula o percentual do total, em centavos", () => {
    expect(valorDoPercentual(9299.23, 20)).toBe(1859.85);
    expect(valorDoPercentual(9299.23, 100)).toBe(9299.23);
    expect(valorDoPercentual(9299.23, 0)).toBe(0);
  });
});

describe("calcularCobranca", () => {
  it("sem percentual ou com 0% o valor fica normal, sem dedução", () => {
    expect(calcularCobranca(9299.23, null)).toMatchObject({ cobrar: 9299.23, deduzido: 0 });
    expect(calcularCobranca(9299.23, 0)).toMatchObject({ cobrar: 9299.23, deduzido: 0 });
  });

  it("com percentual deduz esse percentual da NF e cobra o restante", () => {
    expect(calcularCobranca(9299.23, 20)).toMatchObject({ cobrar: 7439.38, deduzido: 1859.85 });
    expect(calcularCobranca(9299.23, 100)).toMatchObject({ cobrar: 0, deduzido: 9299.23 });
  });
});

describe("percentuais no link do PDF", () => {
  it("serializa e lê de volta", () => {
    const mapa = new Map([
      [90103398, 20],
      [90103430, 7.5],
    ]);
    const texto = serializarPercentuais(mapa);
    expect(texto).toBe("90103398:20,90103430:7.5");
    expect(lerPercentuaisSerializados(texto)).toEqual(mapa);
  });

  it("ignora pares malformados, 0% e parâmetro ausente", () => {
    expect(lerPercentuaisSerializados("90103398:20,abc:5,90103430:xx,:,7,90103431:0")).toEqual(new Map([[90103398, 20]]));
    expect(lerPercentuaisSerializados(null)).toEqual(new Map());
    expect(lerPercentuaisSerializados("")).toEqual(new Map());
  });

  it("não serializa 0%", () => {
    expect(serializarPercentuais(new Map([[1, 0], [2, 10]]))).toBe("2:10");
  });
});

describe("lerValorReais", () => {
  it("aceita os formatos usados no Brasil e com ponto decimal", () => {
    expect(lerValorReais("1500")).toBe(1500);
    expect(lerValorReais("1.500,50")).toBe(1500.5);
    expect(lerValorReais("1500,5")).toBe(1500.5);
    expect(lerValorReais("1500.5")).toBe(1500.5);
    expect(lerValorReais("R$ 1.500,00")).toBe(1500);
    expect(lerValorReais("1.500")).toBe(1500);
    expect(lerValorReais("1.234.567,89")).toBe(1234567.89);
    expect(lerValorReais("0")).toBe(0);
  });

  it("rejeita vazio, texto e negativo", () => {
    expect(lerValorReais("")).toBeNull();
    expect(lerValorReais("abc")).toBeNull();
    expect(lerValorReais("-10")).toBeNull();
  });
});

describe("adiantamentoAtivo", () => {
  it("R$ 0 e vazio são 'sem adiantamento'", () => {
    expect(adiantamentoAtivo("0")).toBeNull();
    expect(adiantamentoAtivo("")).toBeNull();
    expect(adiantamentoAtivo("250,5")).toBe(250.5);
  });
});

describe("calcularCobranca com adiantamento", () => {
  it("o adiantamento sai do total do colaborador, igual ao percentual", () => {
    expect(calcularCobranca(9299.23, null, 1000)).toEqual({ cobrar: 8299.23, deduzido: 1000, deducaoPercentual: 0, adiantamento: 1000 });
  });

  it("percentual e adiantamento se somam, e o percentual incide só sobre a NF", () => {
    // 20% de 9299,23 = 1859,85; + adiantamento 1000 = 2859,85 deduzidos; cobra 6439,38.
    expect(calcularCobranca(9299.23, 20, 1000)).toEqual({ cobrar: 6439.38, deduzido: 2859.85, deducaoPercentual: 1859.85, adiantamento: 1000 });
  });

  it("sem percentual nem adiantamento fica normal", () => {
    expect(calcularCobranca(9299.23, 0, 0)).toEqual({ cobrar: 9299.23, deduzido: 0, deducaoPercentual: 0, adiantamento: 0 });
  });
});

describe("adiantamentos no link do PDF", () => {
  it("serializa, lê de volta e ignora malformados e zero", () => {
    const mapa = new Map([[90103398, 1500], [90103430, 250.5]]);
    const texto = serializarAdiantamentos(mapa);
    expect(texto).toBe("90103398:1500,90103430:250.5");
    expect(lerAdiantamentosSerializados(texto)).toEqual(mapa);
    expect(lerAdiantamentosSerializados("90103398:1500,abc:5,90103430:xx,90103431:0,:,7")).toEqual(new Map([[90103398, 1500]]));
    expect(lerAdiantamentosSerializados(null)).toEqual(new Map());
  });

  it("junta percentuais e adiantamentos por matrícula", () => {
    const junto = juntarDeducoes(new Map([[1, 20]]), new Map([[1, 100], [2, 50]]));
    expect(junto).toEqual(new Map([[1, { percentual: 20, adiantamento: 100 }], [2, { percentual: null, adiantamento: 50 }]]));
  });
});

describe("somarCobranca", () => {
  const colaboradores = [
    { matricula: 1, nf: 9299.23 },
    { matricula: 2, nf: 9299.23 },
    { matricula: 3, nf: 9299.23 },
  ];

  it("soma percentual e adiantamento; quem não tem dedução entra com a NF inteira", () => {
    const deducoes = juntarDeducoes(new Map([[1, 20]]), new Map([[1, 1000], [3, 450.5]]));
    expect(somarCobranca(colaboradores, deducoes)).toEqual({ cobrar: 24587.34, deduzido: 3310.35, adiantamentos: 1450.5 });
  });

  it("sem deduções o valor fica normal", () => {
    expect(somarCobranca(colaboradores, new Map())).toEqual({ cobrar: 27897.69, deduzido: 0, adiantamentos: 0 });
  });
});
