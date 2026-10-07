import { describe, expect, it } from "vitest";
import { lerPercentual, valorACobrar } from "./percentualCobranca";

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
  it("calcula o percentual do Total fatura, em centavos", () => {
    expect(valorACobrar(46496.15, 80)).toBe(37196.92);
    expect(valorACobrar(46496.15, 100)).toBe(46496.15);
    expect(valorACobrar(46496.15, 0)).toBe(0);
  });
});
