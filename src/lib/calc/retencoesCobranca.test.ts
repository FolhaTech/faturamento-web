import { describe, expect, it } from "vitest";
import { calcularRetencoes, type CcustoResumo, type ColaboradorResumo, type RubricaSomada } from "./aggregate";
import { calcularRetencoesSobreCobrado } from "./retencoesCobranca";

const beneficio = (evento: string, valor: number): RubricaSomada => ({
  codigo: 322,
  evento,
  tipo: "I",
  trilha: "beneficio",
  qtdLancamentos: 1,
  valorBruto: valor,
  inss: 0,
  fgts: 0,
  provFerias: 0,
  prov13: 0,
  encInss: 0,
  encFgts: 0,
  totalProvisoes: 0,
  despesa: valor,
  taxaAdm: 0,
  fatura: valor,
  impostos: 0,
  nf: valor,
});

const colaborador = (matricula: number, nf: number, rubricas: RubricaSomada[] = []): ColaboradorResumo => ({
  matricula,
  nome: `COLAB ${matricula}`,
  despesa: nf,
  taxaAdm: 0,
  fatura: nf,
  impostos: 0,
  nf,
  rubricas,
});

/** SUPERMERCADO CHAMA da Folha 09/2026: 2 colaboradores de R$ 9.190,91 cada (Total fatura ≈ 18.381,81). */
function resumoChama(colaboradores: ColaboradorResumo[]): CcustoResumo {
  const total = colaboradores.reduce((s, c) => s + c.nf, 0);
  const baseInss = total - 920; // 920 de VR (benefício excluído da base do INSS)
  return {
    ccustoCodigo: "25",
    ccustoNome: "SUPERMERCADO CHAMA",
    tomadorCodigo: 36,
    tomadorNome: "GRUPO CHAMA",
    tomadorGrossUp: 0.8375,
    tomadorGrossUpOperacao: "/",
    competencia: "09/2026 (Folha)",
    qtdColaboradores: colaboradores.length,
    rubricas: [],
    totalDespesas: 0,
    taxaAdministrativa: 0,
    totalFaturaSemEncargos: 0,
    encargosFatura: { pis: 0, cofins: 0, iss: 0, csll: 0, irrf: 0, total: 0 },
    totalFatura: total,
    baseRetencaoInss: baseInss,
    retencoes: calcularRetencoes(total, baseInss),
    valorLiquido: total - calcularRetencoes(total, baseInss).total,
    colaboradores,
  };
}

describe("calcularRetencoesSobreCobrado", () => {
  const dois = () => [colaborador(1, 9190.91, [beneficio("VALE REFEICAO FORNECIDO*", 460)]), colaborador(2, 9190.91, [beneficio("VALE REFEICAO FORNECIDO*", 460)])];

  it("sem nenhuma dedução devolve null (valem as retenções de sempre, sobre o Total fatura)", () => {
    expect(calcularRetencoesSobreCobrado(resumoChama(dois()), new Map())).toBeNull();
  });

  it("com dedução, os tributos incidem sobre o valor a cobrar e não sobre o Total fatura", () => {
    const resumo = resumoChama(dois());
    // Colaborador 1 paga só 10% (deduz 90%); o 2 entra inteiro: cobrar = 919,09 + 9190,91 = 10110,00.
    const r = calcularRetencoesSobreCobrado(resumo, new Map([[1, { percentual: 90, adiantamento: 0 }]]))!;
    expect(r.cobrar).toBe(10110);
    expect(r.deduzido).toBe(8271.82);
    expect(r.baseRetencoes).toBe(10110);
    expect(r.retencoes.irrf).toBeCloseTo(101.1, 6); // 1% de 10.110, não de 18.381,82
    expect(r.retencoes.irrf).toBeLessThan(resumo.retencoes.irrf);
    expect(r.valorLiquido).toBeCloseTo(10110 - r.retencoes.total, 2);
    expect(r.valorLiquido).toBeGreaterThan(resumo.valorLiquido - 8271.82); // antes: líquido do total menos o deduzido
  });

  it("a base do INSS segue a mesma proporção, sem os benefícios (VR) do colaborador", () => {
    const resumo = resumoChama(dois());
    const r = calcularRetencoesSobreCobrado(resumo, new Map([[1, { percentual: 50, adiantamento: 0 }]]))!;
    // colab 1: (9190,91 − 460) × 50% = 4365,455 ; colab 2: 9190,91 − 460 = 8730,91 → 13096,365
    expect(r.baseInss).toBeCloseTo(13096.365, 1); // exibido em centavos; o INSS abaixo usa a base sem arredondar
    expect(r.retencoes.inss).toBeCloseTo(13096.365 * 0.11, 2); // 11% da base do INSS (a dedução já vem arredondada em centavos)
  });

  it("base informada à mão (sem nenhuma dedução): os tributos saem dela, e o líquido é ela menos as retenções", () => {
    const resumo = resumoChama(dois());
    const r = calcularRetencoesSobreCobrado(resumo, new Map(), 9274.42)!;
    expect(r.baseInformada).toBe(true);
    expect(r.baseRetencoes).toBe(9274.42);
    expect(r.retencoes.irrf).toBeCloseTo(92.7442, 6); // 1% de 9.274,42 (e não de 18.381,82)
    expect(r.retencoes.cofins).toBeCloseTo(278.2326, 6);
    // INSS: mesma proporção de benefícios (VR) do centro de custo: 17.461,82 de base sobre 18.381,82.
    expect(r.baseInss).toBeCloseTo(9274.42 * (17461.82 / 18381.82), 1);
    expect(r.valorLiquido).toBeCloseTo(9274.42 - r.retencoes.total, 2);
    expect(r.deduzido).toBe(0);
  });

  it("base informada vale mais que o valor a cobrar calculado com deduções", () => {
    const resumo = resumoChama(dois());
    const r = calcularRetencoesSobreCobrado(resumo, new Map([[1, { percentual: 50, adiantamento: 0 }]]), 5000)!;
    expect(r.baseInformada).toBe(true);
    expect(r.baseRetencoes).toBe(5000);
    expect(r.retencoes.irrf).toBeCloseTo(50, 6);
    expect(r.cobrar).toBe(13786.36); // o valor a cobrar por colaborador continua sendo calculado: (9190,91 − 4595,46) + 9190,91
    expect(r.valorLiquido).toBeCloseTo(5000 - r.retencoes.total, 2);
  });

  it("sem base informada o resultado é o de antes (valor a cobrar)", () => {
    const resumo = resumoChama(dois());
    const sem = calcularRetencoesSobreCobrado(resumo, new Map([[1, { percentual: 90, adiantamento: 0 }]]), null)!;
    expect(sem.baseInformada).toBe(false);
    expect(sem.baseRetencoes).toBe(10110);
  });

  it("adiantamento maior que o total de um colaborador: ele fica negativo e a base das retenções é exatamente o valor a cobrar", () => {
    const resumo = resumoChama(dois());
    const r = calcularRetencoesSobreCobrado(resumo, new Map([[1, { percentual: null, adiantamento: 20000 }]]))!;
    expect(r.cobrar).toBe(-1618.18); // (9190,91 − 20000) + 9190,91
    expect(r.baseRetencoes).toBe(r.cobrar); // a base não ignora o colaborador negativo
    expect(r.retencoes.irrf).toBeCloseTo(-16.1818, 6); // 1% de −1.618,18: devolve valor ao cliente
    expect(r.retencoes.total).toBeLessThan(0);
    expect(r.valorLiquido).toBeCloseTo(r.cobrar - r.retencoes.total, 2);
  });

  it("Fatura − Adiantamento = A cobrar = Base das retenções (91.086,66 − 91.415,82 = −329,16)", () => {
    // Dois colaboradores: um fica positivo e o outro negativo (adiantamento maior que a própria NF).
    const resumo = resumoChama([colaborador(1, 50000), colaborador(2, 41086.66)]);
    const r = calcularRetencoesSobreCobrado(
      resumo,
      new Map([
        [1, { percentual: null, adiantamento: 30000 }], // 50.000,00 − 30.000,00 = 20.000,00
        [2, { percentual: null, adiantamento: 61415.82 }], // 41.086,66 − 61.415,82 = −20.329,16
      ]),
    )!;
    expect(resumo.totalFatura).toBe(91086.66);
    expect(r.adiantamentos).toBe(91415.82);
    expect(r.cobrar).toBe(-329.16);
    expect(r.baseRetencoes).toBe(-329.16);
    expect(r.retencoes.irrf).toBeCloseTo(-3.2916, 6);
  });
});
