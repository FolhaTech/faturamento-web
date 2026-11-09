import type { CamposCompartilhados } from "../camposCompartilhados";
import { deducoesDoCentroDeCusto, lerPercentual, somarCobranca, type DeducaoColaborador } from "../percentualCobranca";
import type { CcustoResumo } from "./aggregate";

/** Prévia de um Centro de Custo como fica guardada/mostrada na comparação com a Folha (ver calcularPreviaTotalFaturaPorCcusto). */
export interface PreviaParaComparar {
  totalFatura: number;
  /** Valor a cobrar (soma por colaborador) da Prévia. Ausente em fotos salvas antes desse valor existir: aí vale o totalFatura. */
  valorCobrar?: number;
}

/** O que a Prévia cobrou de UM colaborador: a Nota Fiscal dele e o valor a cobrar depois das deduções (% e adiantamento). */
export interface PreviaColaborador {
  matricula: number;
  totalFatura: number;
  valorCobrar: number;
}

/** A Prévia de um Centro de Custo, com o detalhe por colaborador (usado quando o centro de custo da Folha não é o mesmo da Prévia). */
export interface PreviaDoCcusto extends PreviaParaComparar {
  ccustoCodigo: string;
  colaboradores?: PreviaColaborador[];
}

function centavos(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * A Prévia que a Folha de um centro de custo deve comparar: a do MESMO código de centro de custo ou, quando não há (a Folha foi salva
 * ou unificada com outro nome de centro de custo, ex.: "CHAMA LOGISTICO - FOLHA 1026" na Folha e "CHAMA LOGISTICO - PREVIA 1026" na
 * Prévia), a soma do que a Prévia cobrou dos colaboradores desse centro de custo da Folha. null quando nenhum deles está na Prévia.
 */
export function acharPreviaDoCcusto(ccustoCodigo: string, matriculas: number[], previas: PreviaDoCcusto[]): PreviaParaComparar | null {
  const mesmoCodigo = previas.find((p) => p.ccustoCodigo === ccustoCodigo);
  if (mesmoCodigo) return mesmoCodigo;
  const doCcusto = new Set(matriculas);
  let achou = false;
  let totalFatura = 0;
  let valorCobrar = 0;
  for (const p of previas) {
    for (const c of p.colaboradores ?? []) {
      if (!doCcusto.has(c.matricula)) continue;
      achou = true;
      totalFatura += c.totalFatura;
      valorCobrar += c.valorCobrar;
    }
  }
  return achou ? { totalFatura: centavos(totalFatura), valorCobrar: centavos(valorCobrar) } : null;
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
