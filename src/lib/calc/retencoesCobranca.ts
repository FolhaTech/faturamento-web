import { calcularRetencoes, ehBeneficioExcluidoDaBaseInss, type CcustoResumo, type RetencoesFonte } from "./aggregate";
import { calcularCobranca, type DeducaoColaborador } from "../percentualCobranca";

export interface RetencoesSobreCobrado {
  /** Valor a cobrar do centro de custo: soma, por colaborador, da Nota Fiscal menos as deduções (percentual + adiantamento). */
  cobrar: number;
  /** Total deduzido (percentual + adiantamento). */
  deduzido: number;
  /** Parte do deduzido que é adiantamento. */
  adiantamentos: number;
  /** Base das retenções: o valor a cobrar (nunca negativo — um adiantamento maior que o total do colaborador zera a base dele) ou, quando informada à mão, a base informada. */
  baseRetencoes: number;
  /** true = a base das retenções foi digitada pelo usuário (campo "Base das retenções" do card), não calculada. */
  baseInformada: boolean;
  /** Base do INSS: a base das retenções sem VT/VR/VA/Bonificação, na mesma proporção do valor a cobrar de cada colaborador. */
  baseInss: number;
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
 *   inteiro) e a base do INSS segue a mesma proporção;
 * - com `baseInformada` (digitada à mão no card do centro de custo), incidem sobre esse valor; o INSS mantém a proporção
 *   (base do INSS / base das retenções) que o centro de custo teria sem a informada.
 *
 * Devolve null quando não há dedução nem base informada: aí valem as retenções de sempre, sobre o Total fatura
 * (resumo.retencoes / resumo.valorLiquido).
 */
export function calcularRetencoesSobreCobrado(
  resumo: CcustoResumo,
  deducoes: Map<number, DeducaoColaborador>,
  baseInformada: number | null = null,
): RetencoesSobreCobrado | null {
  const temDeducao = resumo.colaboradores.some((c) => deducoes.has(c.matricula));
  if (!temDeducao && baseInformada === null) return null;

  let cobrar = 0;
  let deduzido = 0;
  let adiantamentos = 0;
  let baseRetencoes = 0;
  let baseInss = 0;
  for (const c of resumo.colaboradores) {
    const d = deducoes.get(c.matricula);
    const r = calcularCobranca(c.nf, d?.percentual ?? null, d?.adiantamento ?? 0);
    cobrar += r.cobrar;
    deduzido += r.deduzido;
    adiantamentos += r.adiantamento;

    const sobra = Math.max(0, r.cobrar);
    baseRetencoes += sobra;
    // Parte da NF do colaborador que não é VT/VR/VA/Bonificação (benefícios não entram na base do INSS), na proporção do que sobra.
    const beneficiosExcluidos = c.rubricas.filter((x) => x.trilha === "beneficio" && ehBeneficioExcluidoDaBaseInss(x.evento)).reduce((s, x) => s + x.valorBruto, 0);
    const baseInssDoColaborador = c.nf - beneficiosExcluidos;
    baseInss += c.nf > 0 ? baseInssDoColaborador * (sobra / c.nf) : baseInssDoColaborador;
  }

  if (baseInformada !== null) {
    // Base digitada: o INSS segue a proporção que a base calculada tem de VT/VR/VA/Bonificação.
    baseInss = baseRetencoes > 0 ? baseInss * (baseInformada / baseRetencoes) : 0;
    baseRetencoes = baseInformada;
  }

  const retencoes = calcularRetencoes(baseRetencoes, baseInss);
  return {
    cobrar: centavos(cobrar),
    deduzido: centavos(deduzido),
    adiantamentos: centavos(adiantamentos),
    baseRetencoes: centavos(baseRetencoes),
    baseInformada: baseInformada !== null,
    baseInss: centavos(baseInss),
    retencoes,
    valorLiquido: centavos((baseInformada ?? cobrar) - retencoes.total),
  };
}
