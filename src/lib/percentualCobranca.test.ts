import { describe, expect, it } from "vitest";
import { calcularCobranca, lerPercentual, lerPercentuaisSerializados, serializarPercentuais, valorACobrar } from "./percentualCobranca";

describe("lerPercentual", () => {
  it("aceita vírgula, ponto e o símbolo %", () => {
    expect(lerPercentual("80")).toBe(80);
    expect(lerPercentual("80,5")).toBe(80.5);
    expect(lerPercentual("80.5")).toBe(80.5);
    expect(lerPercentual(" 12,25 % ")).toBe(12.25);
    expect(lerPercentual("0")).toBe(0);
  });

  it("rejeita vazio, texto, negativo e valor absurdo", () => {
    expect(lerPercentual("")).toBeNull();
    expect(lerPercentual("abc")).toBeNull();
    expect(lerPercentual("-5")).toBeNull();
    expect(lerPercentual("1001")).toBeNull();
  });
});

describe("valorACobrar", () => {
  it("calcula o percentual do total, em centavos", () => {
    expect(valorACobrar(9299.23, 80)).toBe(7439.38);
    expect(valorACobrar(9299.23, 100)).toBe(9299.23);
    expect(valorACobrar(9299.23, 0)).toBe(0);
  });
});

describe("calcularCobranca", () => {
  it("sem percentual cobra a NF inteira e não deduz nada", () => {
    expect(calcularCobranca(9299.23, null)).toEqual({ cobrar: 9299.23, deduzido: 0 });
  });

  it("com percentual cobra esse percentual da NF do colaborador e deduz o resto", () => {
    expect(calcularCobranca(9299.23, 80)).toEqual({ cobrar: 7439.38, deduzido: 1859.85 });
    expect(calcularCobranca(9299.23, 100)).toEqual({ cobrar: 9299.23, deduzido: 0 });
  });
});

describe("percentuais no link do PDF", () => {
  it("serializa e lê de volta", () => {
    const mapa = new Map([
      [90103398, 80],
      [90103430, 72.5],
    ]);
    const texto = serializarPercentuais(mapa);
    expect(texto).toBe("90103398:80,90103430:72.5");
    expect(lerPercentuaisSerializados(texto)).toEqual(mapa);
  });

  it("ignora pares malformados e parâmetro ausente", () => {
    expect(lerPercentuaisSerializados("90103398:80,abc:5,90103430:xx,:,7")).toEqual(new Map([[90103398, 80]]));
    expect(lerPercentuaisSerializados(null)).toEqual(new Map());
    expect(lerPercentuaisSerializados("")).toEqual(new Map());
  });
});
