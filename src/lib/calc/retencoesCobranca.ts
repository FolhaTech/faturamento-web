import { calcularRetencoes, ehBeneficioExcluidoDaBaseInss, type CcustoResumo, type RetencoesFonte } from "./aggregate";
import { calcularCobranca, type DeducaoColaborador } from "../percentualCobranca";

export interface RetencoesSobreCobrado {
  /** Valor a cobrar do centro de custo: soma, por colaborador, da Nota Fiscal menos as deduções (percentual + adiantamento). */
  cobrar: number;
  /** Total deduzido (percentual + adiantamento). */
  deduzido: number;
  /** Parte do deduzido que é adiantamento. */
  adiantamentos: number;
  /** Base das retenções: o valor a cobrar (Fatura − Adiantamento, pode ficar negativo: o adiantamento que passa da NF de um colaborador abate dos demais e devolve valor ao cliente) ou, quando informada à mão, a base informada. */
  baseRetencoes: number;
  /** true = a base das retenções foi digitada pelo usuário (campo "Base das retenções" do card), não calculada. */
  baseInformada: boolean;
  /** Base do INSS: a base das retenções menos VT/VR/VA/Bonificação do centro de custo (a mesma regra do Total fatura). */
  baseInss: number;
  /** true = o valor do INSS foi digitado pelo usuário (campo "INSS (R$)" do card) e substitui o calculado em `retencoes.inss`. */
  inssInformado: boolean;
  retencoes: RetencoesFonte;
  /** Valor líquido a receber: a base das retenções (valor a cobrar ou base informada) menos as retenções que incidem sobre ela. */
  valorLiquido: number;
}

function centavos(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Retenções e valor líquido quando os tributos NÃO incidem sobre o Total fatura inteiro:
 *
 * - com deduções por colaborador (percentual e/ou adiantamento digitados no Faturamento), incidem sobre o VALOR A COBRAR —
 *   cada colaborador entra com a parte da Nota Fiscal que sobra depois das deduções dele (quem não tem dedução entra
 *   inteiro; quem passa da própria NF fica negativo e abate dos demais);
 * - com `baseInformada` (digitada à mão no card do centro de custo), incidem sobre esse valor;
 * - o INSS (11%) incide sobre essa base menos VT/VR/VA/Bonificação do centro de custo, como no Total fatura;
 * - com `inssInformado` (valor do INSS em R$ digitado à mão no card), esse valor SUBSTITUI o INSS calculado: entra no total das
 *   retenções e, por isso, no valor líquido a receber. Vale também sozinho (sem dedução nem base informada): as demais retenções
 *   continuam sobre o Total fatura. 0 é um valor válido (INSS zerado); só null/ausente volta ao calculado.
 *
 * Devolve null quando não há dedução, base informada nem INSS informado: aí valem as retenções de sempre, sobre o Total fatura
 * (resumo.retencoes / resumo.valorLiquido).
 */
export function calcularRetencoesSobreCobrado(
  resumo: CcustoResumo,
  deducoes: Map<number, DeducaoColaborador>,
  baseInformada: number | null = null,
  inssInformado: number | null = null,
): RetencoesSobreCobrado | null {
  const temDeducao = resumo.colaboradores.some((c) => deducoes.has(c.matricula));
  if (!temDeducao && baseInformada === null && inssInformado === null) return null;

  let cobrar = 0;
  let deduzido = 0;
  let adiantamentos = 0;
  let beneficiosExcluidos = 0;
  for (const c of resumo.colaboradores) {
    const d = deducoes.get(c.matricula);
    const r = calcularCobranca(c.nf, d?.percentual ?? null, d?.adiantamento ?? 0);
    cobrar += r.cobrar;
    deduzido += r.deduzido;
    adiantamentos += r.adiantamento;
    // VT/VR/VA/Bonificação do colaborador (valor de face): não entram na base do INSS.
    beneficiosExcluidos += c.rubricas.filter((x) => x.trilha === "beneficio" && ehBeneficioExcluidoDaBaseInss(x.evento)).reduce((s, x) => s + x.valorBruto, 0);
  }

  // A base é exatamente o valor a cobrar (ou a informada à mão): quem tem adiantamento maior que a própria NF fica negativo e abate
  // dos demais (o centro de custo devolve esse valor ao cliente) — nada é zerado, senão a base deixaria de bater com Fatura − Adiantamento.
  const baseRetencoes = baseInformada ?? cobrar;
  const baseInss = baseDoInss(baseRetencoes, beneficiosExcluidos);

  const calculadas = calcularRetencoes(baseRetencoes, baseInss);
  // INSS digitado: troca o calculado e o total das retenções (e o líquido a receber) passa a contar com ele.
  const retencoes: RetencoesFonte =
    inssInformado === null ? calculadas : { ...calculadas, inss: inssInformado, total: calculadas.total - calculadas.inss + inssInformado };
  return {
    cobrar: centavos(cobrar),
    deduzido: centavos(deduzido),
    adiantamentos: centavos(adiantamentos),
    baseRetencoes: centavos(baseRetencoes),
    baseInformada: baseInformada !== null,
    baseInss: centavos(baseInss),
    inssInformado: inssInformado !== null,
    retencoes,
    valorLiquido: centavos(baseRetencoes - retencoes.total),
  };
}

/**
 * Base do INSS (11%): a base das retenções sem VT/VR/VA/Bonificação — a mesma regra do Total fatura (baseRetencaoInss em
 * aggregate.ts), só que a partir do valor a cobrar. Nunca fica negativa quando a base é positiva (benefícios maiores que a base
 * zeram o INSS); com base zerada ou negativa (devolução ao cliente) não há benefício a descontar e o INSS acompanha a própria base.
 */
function baseDoInss(baseRetencoes: number, beneficiosExcluidos: number): number {
  return baseRetencoes > 0 ? Math.max(0, baseRetencoes - beneficiosExcluidos) : baseRetencoes;
}
