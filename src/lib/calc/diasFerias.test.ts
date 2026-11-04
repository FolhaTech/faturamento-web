import { describe, expect, it } from "vitest";
import { diasGozadosPorMes, hojeSaoPaulo, saldoDiasFerias } from "./diasFerias";
import { mesReserva } from "./reservasFaturadas";

describe("dias de férias", () => {
  it("acrescenta 2,5 no aniversário mensal e limita o cálculo ao desligamento", () => {
    expect(saldoDiasFerias("31/01/2026", null, [], "2026-02-27").acumulados).toBe(0);
    expect(saldoDiasFerias("31/01/2026", null, [], "2026-02-28").acumulados).toBe(2.5);
    expect(saldoDiasFerias("31/01/2026", "2026-02-28", [], "2026-04-30").acumulados).toBe(2.5);
    expect(hojeSaoPaulo(new Date("2026-11-05T01:00:00Z"))).toBe("2026-11-04");
  });

  it("soma a referência em dias da Folha e exclui Prévia, terço e abono", () => {
    const folha = { competencia: "08/2026 (Folha)", evento: "Férias gozadas", forma: "Dias", ref: 7, cadastrado: false };
    const movimentos = diasGozadosPorMes([
      folha, { ...folha, ref: 3 },
      { ...folha, competencia: "08/2026 (Prévia)" },
      { ...folha, evento: "1/3 de férias", cadastrado: true },
      { ...folha, evento: "Abono de férias", cadastrado: true },
      { ...folha, forma: "R$" },
    ]);
    expect(movimentos).toEqual([{ mes: mesReserva("08/2026"), dias: 10 }]);
    expect(saldoDiasFerias("2026-01-01", null, movimentos, "2026-08-01")).toMatchObject({
      acumulados: 17.5, utilizados: 10, saldo: 7.5,
    });
  });
});
