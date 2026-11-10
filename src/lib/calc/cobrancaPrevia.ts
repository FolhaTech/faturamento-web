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

/** Soma duas Prévias de centro de custo (o valor a cobrar de foto antiga, sem ele, vale o Total fatura). */
function somarPrevias(a: PreviaParaComparar | undefined, b: PreviaParaComparar): PreviaParaComparar {
  return {
    totalFatura: centavos((a?.totalFatura ?? 0) + b.totalFatura),
    valorCobrar: centavos((a?.valorCobrar ?? a?.totalFatura ?? 0) + (b.valorCobrar ?? b.totalFatura)),
  };
}

/**
 * Casa a Prévia com cada centro de custo da Folha, pelo código do centro de custo do centro (`ccustoCodigo`) e pelos colaboradores (`matriculas`):
 * 1. a Prévia de MESMO código de centro de custo vai pro centro da Folha com esse código;
 * 2. cada Prévia que sobrou (o centro de custo da Folha tem outro nome — foi salvo/unificado com outro nome, ex.: "CHAMA LOGISTICO - FOLHA 1026"
 *    na Folha e "CHAMA LOGISTICO - PREVIA 1026" na Prévia) vai INTEIRA pro centro da Folha que tem mais colaboradores em comum com ela (empate:
 *    o maior). Inteira porque a Prévia cobrou o centro de custo todo — colaboradores dela que estão noutro centro da Folha (ex.: 2 do
 *    "ADIANTAMENTO") não ficam de fora do que já foi cobrado. Cada Prévia vai pra UM centro só, então nada é descontado duas vezes.
 * Centro da Folha sem Prévia correspondente fica fora do mapa. Foto antiga de Prévia, sem o detalhe por colaborador, só casa pelo código.
 */
export function casarPreviasComCcustos(ccustos: { ccustoCodigo: string; matriculas: number[] }[], previas: PreviaDoCcusto[]): Map<string, PreviaParaComparar> {
  const resultado = new Map<string, PreviaParaComparar>();
  const usadas = new Set<PreviaDoCcusto>();
  for (const c of ccustos) {
    const mesmoCodigo = previas.find((p) => p.ccustoCodigo === c.ccustoCodigo);
    if (!mesmoCodigo) continue;
    resultado.set(c.ccustoCodigo, mesmoCodigo);
    usadas.add(mesmoCodigo);
  }
  for (const p of previas) {
    if (usadas.has(p) || !p.colaboradores?.length) continue;
    const daPrevia = new Set(p.colaboradores.map((c) => c.matricula));
    let melhor: { codigo: string; emComum: number; tamanho: number } | null = null;
    for (const c of ccustos) {
      const emComum = c.matriculas.filter((m) => daPrevia.has(m)).length;
      if (emComum === 0) continue;
      if (melhor === null || emComum > melhor.emComum || (emComum === melhor.emComum && c.matriculas.length > melhor.tamanho)) {
        melhor = { codigo: c.ccustoCodigo, emComum, tamanho: c.matriculas.length };
      }
    }
    if (melhor === null) continue;
    resultado.set(melhor.codigo, somarPrevias(resultado.get(melhor.codigo), p));
  }
  return resultado;
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
