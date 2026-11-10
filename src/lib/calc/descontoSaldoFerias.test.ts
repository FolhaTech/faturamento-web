import { describe, expect, it } from "vitest";
import {
  CODIGO_DESCONTO_AVISO_PREVIO,
  CODIGO_DESCONTO_SALDO_FERIAS,
  CODIGO_DESCONTO_SALDO_UM_TERCO,
  eventoDoDescontoSaldo,
} from "./descontoSaldoFerias";

describe("eventoDoDescontoSaldo — evento de cada lançamento da tela do colaborador", () => {
  it("o crédito da reserva da Folha (desconto) tem código e nome próprios de férias, 13º salário e aviso prévio", () => {
    expect(eventoDoDescontoSaldo("ferias")).toEqual({ codigo: CODIGO_DESCONTO_SALDO_FERIAS, evento: "DESCONTO SALDO DE FÉRIAS" });
    expect(eventoDoDescontoSaldo("terco")).toEqual({ codigo: CODIGO_DESCONTO_SALDO_UM_TERCO, evento: "DESCONTO SALDO DE 13° SALÁRIO" });
    expect(eventoDoDescontoSaldo("aviso")).toEqual({ codigo: CODIGO_DESCONTO_AVISO_PREVIO, evento: "DESCONTO AVISO PRÉVIO" });
  });

  it("o que se digita na ficha é PROVISÃO lançada: mesmos códigos, nomes de provisão", () => {
    expect(eventoDoDescontoSaldo("ferias", true)).toEqual({ codigo: CODIGO_DESCONTO_SALDO_FERIAS, evento: "PROVISÃO LANÇADA DE FÉRIAS" });
    expect(eventoDoDescontoSaldo("terco", true)).toEqual({ codigo: CODIGO_DESCONTO_SALDO_UM_TERCO, evento: "PROVISÃO LANÇADA DE 13° SALÁRIO" });
    expect(eventoDoDescontoSaldo("aviso", true)).toEqual({ codigo: CODIGO_DESCONTO_AVISO_PREVIO, evento: "PROVISÃO LANÇADA DE AVISO PRÉVIO" });
  });

  it("os três códigos reservados são diferentes entre si", () => {
    const codigos = [CODIGO_DESCONTO_SALDO_FERIAS, CODIGO_DESCONTO_SALDO_UM_TERCO, CODIGO_DESCONTO_AVISO_PREVIO];
    expect(new Set(codigos).size).toBe(3);
    expect(CODIGO_DESCONTO_AVISO_PREVIO).toBe(900003);
  });
});
