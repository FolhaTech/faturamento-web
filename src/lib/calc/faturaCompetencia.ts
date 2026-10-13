import type { CamposCompartilhados } from "../camposCompartilhados";
import { getFaturaSalvaDoUsuario, getFaturaSalvaPorId } from "../repo/faturasSalvas";
import { listEventosExcluidosKeys } from "../repo/eventosExcluidos";
import { listMovimentosByCompetencia } from "../repo/movimentos";
import { aggregateByCcusto } from "./aggregate";
import type { CalculatedLine } from "./engine";
import { runEngine } from "./engine";
import { filtrarEventosExcluidos } from "./eventosExcluidos";
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
  /** Quando as linhas vêm de uma versão salva escolhida pelo id (?versao=) — de quem é — e não da versão ativa do próprio usuário. */
  versaoDe: { id: string; usuarioEmail: string; usuarioNome: string } | null;
  /** % a deduzir, adiantamento e base das retenções guardados junto com a versão salva mostrada — null no cálculo ao vivo e em versões de antes de esses valores serem guardados. */
  campos: CamposCompartilhados | null;
}

/**
 * Cálculo AO VIVO de uma competência (sem foto salva) — já com os eventos excluídos manualmente
 * por Centro de Custo removidos (ver eventosExcluidos.ts/repo/eventosExcluidos.ts). Usado tanto
 * pra mostrar na tela (carregarEngineLines) quanto pra virar uma foto salva (ver
 * /api/faturamento/salvar), pra uma exclusão feita antes de salvar entrar na foto também.
 */
export async function calcularLinesAoVivo(competencia: string): Promise<{ lines: CalculatedLine[]; warnings: string[] }> {
  const movimentos = await listMovimentosByCompetencia(competencia);
  const { lines, warnings } = await runEngine(movimentos);
  const excluidos = await listEventosExcluidosKeys(competencia);
  return { lines: filtrarEventosExcluidos(lines, excluidos), warnings };
}

/**
 * Linhas calculadas de uma competência — foto salva do PRÓPRIO usuário (`usuarioEmail`) se
 * existir, senão calcula ao vivo (ver SalvarFaturaBanner/faturasSalvas.ts). Cada usuário só vê a
 * própria foto: dois usuários vendo a mesma competência podem ver números diferentes se só um
 * deles salvou. `usuarioEmail` null (sessão sem usuário) sempre cai no cálculo ao vivo.
 * Reaproveitado pela tela de Faturamento e pelo export de PDF, pra nunca divergir.
 */
export async function carregarEngineLines(competencia: string, usuarioEmail: string | null, versaoId: string | null = null): Promise<EngineLinesCarregadas> {
  // Versão salva por OUTRA pessoa (ou uma antiga) aberta só pra ver (?versao= na tela de Faturamento): vale por cima da versão ativa
  // do usuário, sem mudar a dele nem a de quem salvou. Id inexistente/de outra competência cai no fluxo normal.
  if (versaoId) {
    const versao = await getFaturaSalvaPorId(competencia, versaoId);
    if (versao) {
      return {
        lines: versao.lines,
        warnings: versao.warnings,
        salvoEm: versao.salvoEm,
        previaTotalFaturaPorCcusto: versao.previaTotalFaturaPorCcusto,
        versaoDe: { id: versao.id, usuarioEmail: versao.usuarioEmail, usuarioNome: versao.usuarioNome },
        campos: versao.campos,
      };
    }
  }
  const salva = usuarioEmail ? await getFaturaSalvaDoUsuario(competencia, usuarioEmail) : null;
  if (salva) {
    return { lines: salva.lines, warnings: salva.warnings, salvoEm: salva.salvoEm, previaTotalFaturaPorCcusto: salva.previaTotalFaturaPorCcusto, versaoDe: null, campos: salva.campos };
  }
  const { lines, warnings } = await calcularLinesAoVivo(competencia);
  return { lines, warnings, salvoEm: null, previaTotalFaturaPorCcusto: null, versaoDe: null, campos: null };
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
export async function calcularPreviaTotalFaturaPorCcusto(competencia: string, usuarioEmail: string | null): Promise<PreviaTotalPorCcusto[]> {
  const competenciaPrevia = trocarTipoCompetencia(competencia, "folha", "previa");
  if (!competenciaPrevia) return [];

  const { lines } = await carregarEngineLines(competenciaPrevia, usuarioEmail);
  if (lines.length === 0) return [];

  const resumosPrevia = aggregateByCcusto(lines, competenciaPrevia);
  return resumosPrevia.map((r) => ({ ccustoCodigo: r.ccustoCodigo, totalFatura: r.totalFatura }));
}
