import type { CamposCompartilhados } from "../camposCompartilhados";
import { deducoesDoCentroDeCusto, lerPercentual, somarCobranca, type DeducaoColaborador } from "../percentualCobranca";
import type { CcustoResumo } from "./aggregate";

/** Prévia de um Centro de Custo como fica guardada/mostrada na comparação com a Folha (ver calcularPreviaTotalFaturaPorCcusto). */
export interface PreviaParaComparar {
  totalFatura: number;
  /** Valor a cobrar (soma por colaborador) da Prévia. Ausente em fotos salvas antes desse valor existir: aí vale o totalFatura. */
  valorCobrar?: number;
}

/** "% a deduzir do Total fatura" digitado na Prévia para esse centro de custo — null = vazio ou inválido (0 também deduz nada). */
export function percentualFaturaDoCcusto(campos: CamposCompartilhados, ccustoCodigo: string): number | null {
  return lerPercentual(campos.percentualFatura[ccustoCodigo] ?? "");
}

/**
 * Deduções por colaborador de um centro de custo, a partir dos valores compartilhados da competência. Em competência de Prévia
 * (`prévia` = true) o percentual do centro de custo vale para todo colaborador sem percentual próprio.
 */
export function deducoesDoCcusto(resumo: CcustoResumo, campos: CamposCompartilhados, previa: boolean): Map<number, DeducaoColaborador> {
  const padrao = previa ? percentualFaturaDoCcusto(campos, resumo.ccustoCodigo) : null;
  return deducoesDoCentroDeCusto(
    resumo.colaboradores.map((c) => c.matricula),
    campos.percentual,
    campos.adiantamento,
    padrao,
  );
}

/**
 * "Valor a cobrar (soma por colaborador)" do centro de custo: soma, por colaborador, da Nota Fiscal menos as deduções dele. Sem
 * nenhuma dedução é o próprio Total fatura.
 */
export function valorCobrarDoCcusto(resumo: CcustoResumo, deducoes: Map<number, DeducaoColaborador>): number {
  if (!resumo.colaboradores.some((c) => deducoes.has(c.matricula))) return resumo.totalFatura;
  return somarCobranca(resumo.colaboradores, deducoes).cobrar;
}

/**
 * Complementar da Folha: o "Valor a cobrar" da Folha menos o "Valor a cobrar (soma por colaborador)" que já foi cobrado na Prévia.
 * Positivo = falta cobrar; negativo = a creditar.
 */
export function complementarDaPrevia(valorCobrarFolha: number, previa: PreviaParaComparar): { previaCobrar: number; complementar: number } {
  const previaCobrar = previa.valorCobrar ?? previa.totalFatura;
  return { previaCobrar, complementar: Math.round((valorCobrarFolha - previaCobrar) * 100) / 100 };
}

/**
 * Linhas da comparação com a Prévia no relatório exportado da Folha (PDF, Word e Excel — mesmos rótulos e mesma conta):
 * "Valor a cobrar (soma por colaborador) na Prévia" e o complementar. A Folha entra com o Total fatura (com encargos) — ou com o
 * Valor a cobrar dela (`valorCobrarFolha`) quando tem deduções por colaborador.
 */
export function linhasComplementarDaPrevia(
  totalFatura: number,
  valorCobrarFolha: number | null,
  previa: PreviaParaComparar,
): { previaCobrar: number; rotuloPrevia: string; complementar: number; rotuloComplementar: string } {
  const { previaCobrar, complementar } = complementarDaPrevia(valorCobrarFolha ?? totalFatura, previa);
  const baseFolha = valorCobrarFolha === null ? "Total fatura (com encargos)" : "Valor a cobrar da Folha";
  return {
    previaCobrar,
    rotuloPrevia: "Valor a cobrar (soma por colaborador) na Prévia",
    complementar,
    rotuloComplementar: `${complementar >= 0 ? "Complementar a cobrar" : "Complementar a creditar"} (${baseFolha} − Valor a cobrar da Prévia)`,
  };
}
