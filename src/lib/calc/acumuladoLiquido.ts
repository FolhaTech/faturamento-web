import type { DescontoSaldo } from "../repo/descontosSaldo";
import type { ProvisaoMensal } from "../repo/provisoesMensais";

export interface AcumuladoLiquido {
  /** Prov. Férias acumulada − descontos de férias já lançados. */
  ferias: number;
  /** Prov. 13º acumulada − descontos de 13º já lançados (tipo "terco" em descontos_saldo). */
  terco: number;
}

function arredonda(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * "Acumulado líquido" da Rescisão (provisão acumulada − descontos já lançados) de um colaborador,
 * SEM contar o desconto da própria `competenciaAlvo`: é o valor que passa a ser o desconto dessa
 * competência quando o usuário marca "Sim" no Faturamento. Ignorar o desconto da competência alvo
 * faz marcar "Sim" duas vezes dar o mesmo valor (não desconta de novo o que ele mesmo já lançou).
 */
export function calcularAcumuladoLiquido(
  provisoes: Pick<ProvisaoMensal, "provFerias" | "prov13">[],
  descontos: Pick<DescontoSaldo, "competencia" | "tipo" | "valor">[],
  competenciaAlvo: string,
): AcumuladoLiquido {
  const provFerias = provisoes.reduce((soma, p) => soma + p.provFerias, 0);
  const prov13 = provisoes.reduce((soma, p) => soma + p.prov13, 0);
  const outros = descontos.filter((d) => d.competencia !== competenciaAlvo);
  const descFerias = outros.filter((d) => d.tipo === "ferias").reduce((soma, d) => soma + Math.abs(d.valor), 0);
  const desc13 = outros.filter((d) => d.tipo === "terco").reduce((soma, d) => soma + Math.abs(d.valor), 0);
  return { ferias: arredonda(provFerias - descFerias), terco: arredonda(prov13 - desc13) };
}
