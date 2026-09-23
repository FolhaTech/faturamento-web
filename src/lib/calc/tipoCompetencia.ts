export type TipoCompetencia = "previa" | "folha";

/**
 * Sufixo aplicado à competência lida do arquivo (ex.: "09/2026" -> "09/2026 (Prévia)") — Prévia
 * (cálculo no meio do mês) e Folha (fechamento) da mesma competência ficam como duas
 * "competências" distintas em Movimentos/faturas_salvas/descontos_saldo, sem precisar de coluna
 * nova em lugar nenhum: reenviar Prévia substitui só a Prévia, reenviar Folha substitui só a
 * Folha, e as duas convivem e aparecem separadas no seletor da tela de Faturamento (ver
 * /api/movimentos). Competências antigas, de antes desse recurso existir, ficam sem sufixo —
 * tratadas como uma competência à parte, nem Prévia nem Folha marcada.
 */
const SUFIXOS: Record<TipoCompetencia, string> = { previa: " (Prévia)", folha: " (Folha)" };

/** "09/2026" -> "09/2026 (Prévia)"/"09/2026 (Folha)" — competência vazia (linha com erro de leitura) fica sem sufixo, continua vazia. */
export function aplicarTipoNaCompetencia(competencia: string, tipo: TipoCompetencia): string {
  const base = competencia.trim();
  return base === "" ? competencia : `${base}${SUFIXOS[tipo]}`;
}

/**
 * Troca o sufixo de tipo de uma competência marcada — usado pra achar a Prévia correspondente de
 * uma Folha (e vice-versa) na tela de Faturamento (ver page.tsx). null se `competencia` não
 * terminar com o sufixo de `de` (não é desse tipo, ou é uma competência antiga sem marcação).
 */
export function trocarTipoCompetencia(competencia: string, de: TipoCompetencia, para: TipoCompetencia): string | null {
  if (!competencia.endsWith(SUFIXOS[de])) return null;
  const base = competencia.slice(0, -SUFIXOS[de].length);
  return `${base}${SUFIXOS[para]}`;
}
