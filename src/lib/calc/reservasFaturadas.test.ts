import { describe, expect, it } from "vitest";
import { baseFeriasGozadas, creditoReserva, mesReserva, saldoReserva, usosManuais, type CobrancaReserva } from "./reservasFaturadas";

const agosto = mesReserva("08/2026 (Folha)")!;
const cobrancas: CobrancaReserva[] = Array.from({ length: 13 }, (_, i) => ({
  mes: agosto - 12 + i, periodo: "08/2025", ferias: i === 12 ? 24310 : 23084,
  terco: i < 5 ? 17510 : 20015 + Number(i === 12), aviso: i === 12 ? 25126 : 17510,
}));

describe("reservas faturadas", () => {
  it("abate 14 dias e conserva o saldo exato em centavos e dias", () => {
    const inicial = saldoReserva(cobrancas, [], agosto, "ferias", "08/2025");
    expect(inicial).toMatchObject({ saldo: 301318, dias: 32.5 });
    const valor = creditoReserva(inicial, 14, false);
    expect(valor).toBe(129799);
    const usos = [{ mes: agosto, tipo: "ferias" as const, periodo: "08/2025", valor, dias: 14 }];
    expect(saldoReserva(cobrancas, usos, agosto + 1, "ferias", "08/2025")).toMatchObject({ saldo: 171519, dias: 18.5 });
    expect(saldoReserva(cobrancas, usos, agosto + 1, "ferias", "08/2026").saldo).toBe(0);
    expect(creditoReserva(inicial, 33, false)).toBe(0);
  });

  it("separa o exercício de 13º e não reutiliza o valor já abatido", () => {
    const dezembro = agosto + 4;
    const saldo = saldoReserva(cobrancas, [{ mes: agosto, tipo: "terco", periodo: "", valor: 15000, dias: 0 }], dezembro, "terco", "");
    expect(saldo).toMatchObject({ cobrado: 160121, saldo: 145121 });
    expect(saldoReserva(cobrancas, [], dezembro + 1, "terco", "").saldo).toBe(0);
  });

  it("usa apenas os 12 meses anteriores ao desligamento para aviso prévio", () => {
    const saldo = saldoReserva(cobrancas, [], agosto + 1, "aviso", "");
    expect(saldo.cobrado).toBe(217736);
    expect(saldoReserva(cobrancas, [], agosto, "aviso", "").cobrado).toBe(210120);
  });

  it("quita todos os períodos de férias na rescisão sem devolver créditos anteriores", () => {
    const novoPeriodo = { mes: agosto + 1, periodo: "09/2026", ferias: 10000, terco: 0, aviso: 0 };
    const usos = [{ mes: agosto, tipo: "ferias" as const, periodo: "08/2025", valor: 129799, dias: 14 }];
    const saldo = saldoReserva([...cobrancas, novoPeriodo], usos, agosto + 1, "ferias", "*");
    expect(creditoReserva(saldo, 0, true)).toBe(181519);
  });

  it("deduplica créditos manuais da Prévia e Folha do mesmo mês", () => {
    expect(usosManuais([
      { competencia: "08/2026 (Prévia)", tipo: "ferias", valor: -40 },
      { competencia: "08/2026 (Folha)", tipo: "ferias", valor: -100 },
    ])).toEqual([{ mes: agosto, tipo: "ferias", periodo: "", valor: 10000, dias: 0 }]);
  });
});

it("calcula férias gozadas com a reserva anterior, mesmo com abatimento lançado no mês", () => {
  const mes = mesReserva("10/2026")!;
  const periodo = "09/2025";
  const anteriores = Array.from({ length: 13 }, (_, i) => ({
    mes: mes - i - 1, periodo, ferias: i === 0 ? 23194 : 23177, terco: 0, aviso: 0,
  }));
  const base = baseFeriasGozadas(
    [...anteriores, { mes, periodo, ferias: 13229, terco: 0, aviso: 0 }],
    [{ mes, tipo: "ferias", periodo, valor: 316008, dias: 14 }],
    mes,
    periodo,
    37.5,
  );
  expect(base).toMatchObject({ saldo: 301318, dias: 37.5 });
  expect(creditoReserva(base, 14, false)).toBe(112492);
});
