import { getFaturaSalva } from "../repo/faturasSalvas";
import { listMovimentosByCompetencia } from "../repo/movimentos";
import { aggregateByCcusto } from "./aggregate";
import type { CalculatedLine } from "./engine";
import { runEngine } from "./engine";
import { trocarTipoCompetencia } from "./tipoCompetencia";

/** Total fatura (NF) de um Centro de Custo — usado pra comparar Prévia x Folha (ver calcularPreviaTotalFaturaPorCcusto). */
export interface PreviaTotalPorCcusto {
  ccustoCodigo: string;
  totalFatura: number;
}

export interface EngineLinesCarregadas {
  lines: CalculatedLine[];
  warnings: string[];
  salvoEm: string | null;
  /**
   * Total já cobrado na Prévia por Ccusto, CONGELADO no momento de salvar — só presente quando
   * `competencia` é uma Folha salva com esse campo preenchido (ver salvarFatura em
   * faturasSalvas.ts). null quando não veio de uma foto salva (calcule ao vivo com
   * calcularPreviaTotalFaturaPorCcusto) ou a foto é antiga/não tem Prévia correspondente.
   */
  previaTotalFaturaPorCcusto: PreviaTotalPorCcusto[] | null;
}

/** Linhas calculadas de uma competência — foto salva se existir, senão calcula ao vivo (ver SalvarFaturaBanner/faturasSalvas.ts). Reaproveitado pela tela de Faturamento e pelo export de PDF, pra nunca divergir. */
export async function carregarEngineLines(competencia: string): Promise<EngineLinesCarregadas> {
  const salva = await getFaturaSalva(competencia);
  if (salva) {
    return { lines: salva.lines, warnings: salva.warnings, salvoEm: salva.salvoEm, previaTotalFaturaPorCcusto: salva.previaTotalFaturaPorCcusto };
  }
  const movimentos = await listMovimentosByCompetencia(competencia);
  const { lines, warnings } = await runEngine(movimentos);
  return { lines, warnings, salvoEm: null, previaTotalFaturaPorCcusto: null };
}

/**
 * Total fatura (NF) já cobrado na Prévia correspondente, por Centro de Custo, pra comparar com a
 * Folha (ver TotalsCard em FaturamentoViewer.tsx e SummarySection em FaturamentoPdf.tsx).
 * Sempre ao vivo e SEM filtro de colaborador/cargo/etc — o complementar a cobrar é um valor de
 * fatura inteira, não de um recorte; quem quiser congelar esse valor (pra não mudar se a Prévia
 * for reenviada depois) precisa salvar a fatura da Folha (ver /api/faturamento/salvar), que grava
 * o resultado desta função junto da foto.
 *
 * `competencia` pode ser Folha ou Prévia — só calcula algo quando é uma Folha com Prévia
 * correspondente já enviada; nos demais casos retorna [].
 */
export async function calcularPreviaTotalFaturaPorCcusto(competencia: string): Promise<PreviaTotalPorCcusto[]> {
  const competenciaPrevia = trocarTipoCompetencia(competencia, "folha", "previa");
  if (!competenciaPrevia) return [];

  const { lines } = await carregarEngineLines(competenciaPrevia);
  if (lines.length === 0) return [];

  const resumosPrevia = aggregateByCcusto(lines, competenciaPrevia);
  return resumosPrevia.map((r) => ({ ccustoCodigo: r.ccustoCodigo, totalFatura: r.totalFatura }));
}
