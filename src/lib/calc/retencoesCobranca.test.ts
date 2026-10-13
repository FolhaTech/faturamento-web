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

  it("adiantamento maior que o total do colaborador zera a base dele (nunca base negativa)", () => {
    const resumo = resumoChama(dois());
    const r = calcularRetencoesSobreCobrado(resumo, new Map([[1, { percentual: null, adiantamento: 20000 }]]))!;
    expect(r.baseRetencoes).toBe(9190.91); // só o colaborador 2
    expect(r.cobrar).toBe(-1618.18); // o valor a cobrar exibido continua negativo: (9190,91 − 20000) + 9190,91
  });
});
