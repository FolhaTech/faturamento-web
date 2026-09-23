import { chaveEventoExcluido } from "../repo/eventosExcluidos";
import type { CalculatedLine } from "./engine";

/** Remove das linhas calculadas os eventos excluídos manualmente por Centro de Custo (ver excluirEvento em repo/eventosExcluidos.ts) — aplicado só no cálculo AO VIVO; uma fatura já salva mantém o que tinha no momento de salvar (ver faturasSalvas.ts). */
export function filtrarEventosExcluidos(lines: CalculatedLine[], excluidos: Set<string>): CalculatedLine[] {
  if (excluidos.size === 0) return lines;
  return lines.filter((l) => !excluidos.has(chaveEventoExcluido(l.ccustoCodigo, l.evento)));
}
