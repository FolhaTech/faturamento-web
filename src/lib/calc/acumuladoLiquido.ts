import type { DescontoSaldo } from "../repo/descontosSaldo";
import type { ProvisaoMensal } from "../repo/provisoesMensais";
import { trocarTipoCompetencia } from "./tipoCompetencia";

export interface AcumuladoLiquido {
  /** Prov. Férias acumulada − descontos de férias já lançados. */
  ferias: number;
  /** Prov. 13º acumulada − descontos de 13º já lançados (tipo "terco" em descontos_saldo). */
  terco: number;
}

function arredonda(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Prévia ↔ Folha do mesmo mês ("09/2026 (Folha)" -> "09/2026 (Prévia)"); null pra competência sem marcação (antiga). */
function competenciaPar(competencia: string): string | null {
  return trocarTipoCompetencia(competencia, "folha", "previa") ?? trocarTipoCompetencia(competencia, "previa", "folha");
}

/**
 * "Acumulado líquido" da Rescisão (provisão acumulada − descontos já lançados) de um colaborador,
 * SEM contar o desconto da própria `competenciaAlvo`: é o valor que passa a ser o desconto dessa
 * competência quando o usuário marca "Sim" no Faturamento. Ignorar o desconto da competência alvo
 * faz marcar "Sim" duas vezes dar o mesmo valor (não desconta de novo o que ele mesmo já lançou).
 *
 * Também ignora o desconto da Prévia/Folha PAR da competência alvo: são o mesmo mês (a Prévia é a
 * cobrança antecipada e a Folha o fechamento, que já leva o desconto inteiro), então o desconto de
 * uma não é "já descontado" pra outra — contar os dois zerava o acumulado e o "Sim" não fazia nada.
 */
export function calcularAcumuladoLiquido(
  provisoes: Pick<ProvisaoMensal, "provFerias" | "prov13">[],
  descontos: Pick<DescontoSaldo, "competencia" | "tipo" | "valor">[],
  competenciaAlvo: string,
): AcumuladoLiquido {
  const provFerias = provisoes.reduce((soma, p) => soma + p.provFerias, 0);
  const prov13 = provisoes.reduce((soma, p) => soma + p.prov13, 0);
  const par = competenciaPar(competenciaAlvo);
  const outros = descontos.filter((d) => d.competencia !== competenciaAlvo && d.competencia !== par);
  const descFerias = outros.filter((d) => d.tipo === "ferias").reduce((soma, d) => soma + Math.abs(d.valor), 0);
  const desc13 = outros.filter((d) => d.tipo === "terco").reduce((soma, d) => soma + Math.abs(d.valor), 0);
  return { ferias: arredonda(provFerias - descFerias), terco: arredonda(prov13 - desc13) };
}
