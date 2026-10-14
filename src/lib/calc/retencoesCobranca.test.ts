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
    expect(r.valorLiquido).toBe(Math.round((10110 - r.retencoes.total) * 100) / 100); // em centavos
    expect(r.valorLiquido).toBeGreaterThan(resumo.valorLiquido - 8271.82); // antes: líquido do total menos o deduzido
  });

  it("o INSS incide sobre o valor a cobrar menos VT/VR/VA/Bonificação (a mesma regra do Total fatura)", () => {
    const resumo = resumoChama(dois());
    const r = calcularRetencoesSobreCobrado(resumo, new Map([[1, { percentual: 50, adiantamento: 0 }]]))!;
    // valor a cobrar = (9.190,91 − 4.595,46) + 9.190,91 = 13.786,36 − 460 de VR de cada colaborador (920) = 12.866,36
    expect(r.cobrar).toBe(13786.36);
    expect(r.baseInss).toBeCloseTo(r.baseRetencoes - 920, 2);
    expect(r.retencoes.inss).toBeCloseTo((r.baseRetencoes - 920) * 0.11, 6);
  });

  it("sem dedução nenhuma e sem base informada, nada muda: o cálculo de sempre (Total fatura − VT/VR/VA/Bonif.)", () => {
    const resumo = resumoChama(dois());
    // baseRetencaoInss do resumo = total − 920 de VR: com a base igual ao Total fatura a regra nova dá o mesmo INSS.
    const r = calcularRetencoesSobreCobrado(resumo, new Map(), resumo.totalFatura)!;
    expect(r.baseInss).toBeCloseTo(resumo.baseRetencaoInss, 2);
    expect(r.retencoes.inss).toBeCloseTo(resumo.retencoes.inss, 6);
  });

  describe("INSS digitado à mão", () => {
    it("substitui o INSS calculado e o valor digitado entra na soma das retenções e no valor líquido", () => {
      const resumo = resumoChama(dois());
      const deducoes = new Map([[1, { percentual: 50, adiantamento: 0 }]]);
      const calculado = calcularRetencoesSobreCobrado(resumo, deducoes)!;
      const informado = calcularRetencoesSobreCobrado(resumo, deducoes, null, 1000)!;

      expect(calculado.inssInformado).toBe(false);
      expect(informado.inssInformado).toBe(true);
      expect(informado.retencoes.inss).toBe(1000);
      // As demais retenções não mudam; o total troca só o INSS.
      expect(informado.retencoes.irrf).toBeCloseTo(calculado.retencoes.irrf, 9);
      expect(informado.retencoes.iss).toBeCloseTo(calculado.retencoes.iss, 9);
      expect(informado.retencoes.total).toBeCloseTo(calculado.retencoes.total - calculado.retencoes.inss + 1000, 9);
      const outras = informado.retencoes.irrf + informado.retencoes.csll + informado.retencoes.cofins + informado.retencoes.pis + informado.retencoes.iss;
      expect(informado.retencoes.total).toBeCloseTo(outras + 1000, 9);
      // O líquido sai da base menos as retenções COM o INSS digitado.
      expect(informado.valorLiquido).toBe(Math.round((informado.baseRetencoes - informado.retencoes.total) * 100) / 100);
      expect(informado.valorLiquido).not.toBe(calculado.valorLiquido);
    });

    it("INSS maior que o calculado reduz o líquido; menor aumenta", () => {
      const resumo = resumoChama(dois());
      const deducoes = new Map([[1, { percentual: 50, adiantamento: 0 }]]);
      const calculado = calcularRetencoesSobreCobrado(resumo, deducoes)!;
      const maior = calcularRetencoesSobreCobrado(resumo, deducoes, null, calculado.retencoes.inss + 100)!;
      const menor = calcularRetencoesSobreCobrado(resumo, deducoes, null, calculado.retencoes.inss - 100)!;
      expect(maior.valorLiquido).toBeCloseTo(calculado.valorLiquido - 100, 1);
      expect(menor.valorLiquido).toBeCloseTo(calculado.valorLiquido + 100, 1);
    });

    it("vale sozinho (sem dedução nem base informada): as outras retenções continuam sobre o Total fatura", () => {
      const resumo = resumoChama(dois());
      const r = calcularRetencoesSobreCobrado(resumo, new Map(), null, 1000)!;
      expect(r).not.toBeNull();
      expect(r.baseRetencoes).toBe(resumo.totalFatura);
      expect(r.retencoes.irrf).toBeCloseTo(resumo.retencoes.irrf, 9);
      expect(r.retencoes.inss).toBe(1000);
      expect(r.retencoes.total).toBeCloseTo(resumo.retencoes.total - resumo.retencoes.inss + 1000, 9);
      expect(r.valorLiquido).toBeCloseTo(resumo.totalFatura - r.retencoes.total, 2);
    });

    it("0 é um valor válido (INSS zerado); sem valor informado volta ao calculado", () => {
      const resumo = resumoChama(dois());
      const zerado = calcularRetencoesSobreCobrado(resumo, new Map(), null, 0)!;
      expect(zerado.inssInformado).toBe(true);
      expect(zerado.retencoes.inss).toBe(0);
      expect(zerado.retencoes.total).toBeCloseTo(resumo.retencoes.total - resumo.retencoes.inss, 9);
      expect(calcularRetencoesSobreCobrado(resumo, new Map(), null, null)).toBeNull();
    });

    it("junto com a base informada à mão: a base muda os outros tributos e o INSS digitado entra no total", () => {
      const resumo = resumoChama(dois());
      const r = calcularRetencoesSobreCobrado(resumo, new Map(), 9274.42, 700)!;
      expect(r.baseRetencoes).toBe(9274.42);
      expect(r.retencoes.irrf).toBeCloseTo(92.7442, 6);
      expect(r.retencoes.inss).toBe(700);
      expect(r.valorLiquido).toBeCloseTo(9274.42 - r.retencoes.total, 2);
    });
  });

  it("benefícios maiores que a base positiva zeram o INSS (nunca base de INSS negativa)", () => {
    const resumo = resumoChama(dois()); // 920 de VR
    const r = calcularRetencoesSobreCobrado(resumo, new Map(), 500)!;
    expect(r.baseRetencoes).toBe(500);
    expect(r.baseInss).toBe(0);
    expect(r.retencoes.inss).toBe(0);
  });

  it("base informada à mão (sem nenhuma dedução): os tributos saem dela, e o líquido é ela menos as retenções", () => {
    const resumo = resumoChama(dois());
    const r = calcularRetencoesSobreCobrado(resumo, new Map(), 9274.42)!;
    expect(r.baseInformada).toBe(true);
    expect(r.baseRetencoes).toBe(9274.42);
    expect(r.retencoes.irrf).toBeCloseTo(92.7442, 6); // 1% de 9.274,42 (e não de 18.381,82)
    expect(r.retencoes.cofins).toBeCloseTo(278.2326, 6);
    // INSS: a base informada menos os 920 de VR do centro de custo.
    expect(r.baseInss).toBeCloseTo(9274.42 - 920, 2);
    expect(r.retencoes.inss).toBeCloseTo((9274.42 - 920) * 0.11, 6);
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

  it("caso real (CHAMA LOGISTICA): um colaborador negativo abate dos demais — a base é o valor a cobrar (91.086,66), não a soma só dos positivos (91.415,82)", () => {
    // Colaborador 1: NF 2.819,42 − adiantamento 3.148,58 = −329,16. Colaborador 2 representa os demais: 91.415,82 a cobrar.
    const resumo = resumoChama([colaborador(1, 2819.42, [beneficio("VALE REFEICAO FORNECIDO*", 301.6)]), colaborador(2, 100000, [beneficio("VALE TRANSPORTE", 25013.9)])]);
    const r = calcularRetencoesSobreCobrado(
      resumo,
      new Map([
        [1, { percentual: null, adiantamento: 3148.58 }],
        [2, { percentual: null, adiantamento: 8584.18 }], // 100.000,00 − 8.584,18 = 91.415,82
      ]),
    )!;
    expect(r.cobrar).toBe(91086.66); // 91.415,82 + (−329,16)
    expect(r.baseRetencoes).toBe(91086.66); // antes saía 91.415,82 (o negativo era ignorado na base)
    expect(r.retencoes.irrf).toBeCloseTo(910.8666, 4);
    // INSS: 11% de (91.086,66 − 25.315,50 de VT/VR) = 11% de 65.771,16
    expect(r.baseInss).toBeCloseTo(65771.16, 2);
    expect(r.retencoes.inss).toBeCloseTo(65771.16 * 0.11, 6);
  });
});
