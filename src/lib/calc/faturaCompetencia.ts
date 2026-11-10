import { sincronizarCreditosFeriasDaFolha } from "../repo/reservasFaturadas";
import type { CamposCompartilhados } from "../camposCompartilhados";
import { listCampos } from "../repo/camposFaturamento";
import { getFaturaSalvaDoUsuario, getFaturaSalvaPorId } from "../repo/faturasSalvas";
import { listEventosExcluidosKeys } from "../repo/eventosExcluidos";
import { listMovimentosByCompetencia } from "../repo/movimentos";
import { aggregateByCcusto } from "./aggregate";
import { deducoesDoCcusto, valorCobrarDoCcusto, type PreviaDoCcusto } from "./cobrancaPrevia";
import { calcularCobranca } from "../percentualCobranca";
import type { CalculatedLine } from "./engine";
import { runEngine } from "./engine";
import { filtrarEventosExcluidos } from "./eventosExcluidos";
import { trocarTipoCompetencia } from "./tipoCompetencia";

/** Total fatura (NF) e Valor a cobrar de um Centro de Custo na Prévia — usados pra comparar Prévia x Folha (ver calcularPreviaTotalFaturaPorCcusto). */
/**
 * `valorCobrar` = "Valor a cobrar (soma por colaborador)" da Prévia: o Total fatura menos o % a deduzir (do Centro de Custo e por
 * colaborador) e os adiantamentos digitados na Prévia. É ele que a Folha desconta no complementar. `colaboradores` = o mesmo por
 * colaborador, pra casar com a Folha quando o centro de custo mudou de nome (ver casarPreviasComCcustos). Ausentes em fotos salvas
 * antes de existirem — ver resolverPreviaPorCcusto.
 */
export type PreviaTotalPorCcusto = PreviaDoCcusto;

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
  await sincronizarCreditosFeriasDaFolha(competencia, [...new Set(movimentos.map((m) => m.matricula))]);
  const { lines, warnings } = await runEngine(movimentos, [competencia]);
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
 * Total fatura (NF) e Valor a cobrar (soma por colaborador) já cobrados na Prévia correspondente, por Centro de Custo, pra comparar
 * com a Folha (ver TotalsCard em FaturamentoViewer.tsx e ComparativoPdf.tsx).
 * Sempre ao vivo e SEM filtro de colaborador/cargo/etc — o complementar a cobrar é um valor de
 * fatura inteira, não de um recorte; quem quiser congelar esse valor (pra não mudar se a Prévia
 * for reenviada depois) precisa salvar a fatura da Folha (ver /api/faturamento/salvar), que grava
 * o resultado desta função junto da foto.
 *
 * O Valor a cobrar sai dos valores atuais da própria Prévia (% a deduzir do Centro de Custo, % e adiantamento por colaborador).
 *
 * `competencia` pode ser Folha ou Prévia — só calcula algo quando é uma Folha com Prévia
 * correspondente já enviada; nos demais casos retorna [].
 */
export async function calcularPreviaTotalFaturaPorCcusto(competencia: string, usuarioEmail: string | null): Promise<PreviaTotalPorCcusto[]> {
  const competenciaPrevia = trocarTipoCompetencia(competencia, "folha", "previa");
  if (!competenciaPrevia) return [];

  const { lines } = await carregarEngineLines(competenciaPrevia, usuarioEmail);
  if (lines.length === 0) return [];

  // Os valores ATUAIS da Prévia (inclusive o % herdado de Prévias anteriores) — os mesmos que a tela da Prévia mostra, mesmo que ela tenha
  // uma versão salva de antes de o % existir.
  const camposPrevia = await listCampos(competenciaPrevia);
  const resumosPrevia = aggregateByCcusto(lines, competenciaPrevia);
  return resumosPrevia.map((r) => {
    const deducoes = deducoesDoCcusto(r, camposPrevia, true);
    return {
      ccustoCodigo: r.ccustoCodigo,
      totalFatura: r.totalFatura,
      valorCobrar: valorCobrarDoCcusto(r, deducoes),
      colaboradores: r.colaboradores.map((c) => {
        const d = deducoes.get(c.matricula);
        return { matricula: c.matricula, totalFatura: c.nf, valorCobrar: calcularCobranca(c.nf, d?.percentual ?? null, d?.adiantamento ?? 0).cobrar };
      }),
    };
  });
}

/**
 * Prévia a comparar com a Folha: a foto congelada quando a Folha foi salva, senão o cálculo ao vivo. Foto salva antes de o Valor a
 * cobrar e o detalhe por colaborador existirem não os tem: nesse caso a Prévia inteira vem do cálculo ao vivo (os dois números e o casamento
 * por colaborador saem do mesmo estado da Prévia); sem Prévia ao vivo (foi apagada), fica a foto como está.
 */
export async function resolverPreviaPorCcusto(competencia: string, usuarioEmail: string | null, congelada: PreviaTotalPorCcusto[] | null): Promise<PreviaTotalPorCcusto[]> {
  if (congelada && congelada.every((p) => p.valorCobrar !== undefined && p.colaboradores !== undefined)) return congelada;
  const aoVivo = await calcularPreviaTotalFaturaPorCcusto(competencia, usuarioEmail);
  if (aoVivo.length > 0 || !congelada) return aoVivo;
  return congelada;
}
