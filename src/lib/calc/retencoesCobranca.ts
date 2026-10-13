import { calcularRetencoes, ehBeneficioExcluidoDaBaseInss, type CcustoResumo, type RetencoesFonte } from "./aggregate";
import { calcularCobranca, type DeducaoColaborador } from "../percentualCobranca";

export interface RetencoesSobreCobrado {
  /** Valor a cobrar do centro de custo: soma, por colaborador, da Nota Fiscal menos as deduções (percentual + adiantamento). */
  cobrar: number;
  /** Total deduzido (percentual + adiantamento). */
  deduzido: number;
  /** Parte do deduzido que é adiantamento. */
  adiantamentos: number;
  /** Base das retenções: o valor a cobrar (nunca negativo — um adiantamento maior que o total do colaborador zera a base dele). */
  baseRetencoes: number;
  /** Base do INSS: a base das retenções sem VT/VR/VA/Bonificação, na mesma proporção do valor a cobrar de cada colaborador. */
  baseInss: number;
  retencoes: RetencoesFonte;
  /** Valor líquido a receber: valor a cobrar menos as retenções (que incidem sobre ele, não sobre o Total fatura). */
  valorLiquido: number;
}

function centavos(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Retenções e valor líquido quando há deduções por colaborador (percentual e/ou adiantamento digitados no Faturamento):
 * os tributos passam a incidir sobre o VALOR A COBRAR — o que de fato será faturado — e não sobre o Total fatura inteiro.
 * Cada colaborador entra com a parte da Nota Fiscal que sobra depois das deduções dele (quem não tem dedução entra
 * inteiro); a base do INSS segue a mesma proporção. Devolve null quando ninguém do centro de custo tem dedução: aí
 * valem as retenções de sempre, sobre o Total fatura (resumo.retencoes / resumo.valorLiquido).
 */
export function calcularRetencoesSobreCobrado(resumo: CcustoResumo, deducoes: Map<number, DeducaoColaborador>): RetencoesSobreCobrado | null {
  if (!resumo.colaboradores.some((c) => deducoes.has(c.matricula))) return null;

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

  const retencoes = calcularRetencoes(baseRetencoes, baseInss);
  return {
    cobrar: centavos(cobrar),
    deduzido: centavos(deduzido),
    adiantamentos: centavos(adiantamentos),
    baseRetencoes: centavos(baseRetencoes),
    baseInss: centavos(baseInss),
    retencoes,
    valorLiquido: centavos(cobrar - retencoes.total),
  };
}
