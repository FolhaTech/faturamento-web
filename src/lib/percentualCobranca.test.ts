import { describe, expect, it } from "vitest";
import { calcularCobranca, lerPercentual, lerPercentuaisSerializados, percentualAtivo, serializarPercentuais, valorDoPercentual } from "./percentualCobranca";

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
    expect(calcularCobranca(9299.23, null)).toEqual({ cobrar: 9299.23, deduzido: 0 });
    expect(calcularCobranca(9299.23, 0)).toEqual({ cobrar: 9299.23, deduzido: 0 });
  });

  it("com percentual deduz esse percentual da NF e cobra o restante", () => {
    expect(calcularCobranca(9299.23, 20)).toEqual({ cobrar: 7439.38, deduzido: 1859.85 });
    expect(calcularCobranca(9299.23, 100)).toEqual({ cobrar: 0, deduzido: 9299.23 });
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
