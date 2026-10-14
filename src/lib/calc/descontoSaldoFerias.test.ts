import { describe, expect, it } from "vitest";
import {
  CODIGO_DESCONTO_AVISO_PREVIO,
  CODIGO_DESCONTO_SALDO_FERIAS,
  CODIGO_DESCONTO_SALDO_UM_TERCO,
  eventoDoDescontoSaldo,
} from "./descontoSaldoFerias";

describe("eventoDoDescontoSaldo — evento de cada desconto lançado na tela do colaborador", () => {
  it("férias, 13º salário e aviso prévio têm código e nome próprios", () => {
    expect(eventoDoDescontoSaldo("ferias")).toEqual({ codigo: CODIGO_DESCONTO_SALDO_FERIAS, evento: "DESCONTO SALDO DE FÉRIAS" });
    expect(eventoDoDescontoSaldo("terco")).toEqual({ codigo: CODIGO_DESCONTO_SALDO_UM_TERCO, evento: "DESCONTO SALDO DE 13° SALÁRIO" });
    expect(eventoDoDescontoSaldo("aviso")).toEqual({ codigo: CODIGO_DESCONTO_AVISO_PREVIO, evento: "DESCONTO AVISO PRÉVIO" });
  });

  it("os três códigos reservados são diferentes entre si", () => {
    const codigos = [CODIGO_DESCONTO_SALDO_FERIAS, CODIGO_DESCONTO_SALDO_UM_TERCO, CODIGO_DESCONTO_AVISO_PREVIO];
    expect(new Set(codigos).size).toBe(3);
    expect(CODIGO_DESCONTO_AVISO_PREVIO).toBe(900003);
  });
});
