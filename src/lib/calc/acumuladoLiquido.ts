import type { DescontoSaldo } from "../repo/descontosSaldo";
import type { ProvisaoMensal } from "../repo/provisoesMensais";
import { trocarTipoCompetencia } from "./tipoCompetencia";

/** Os dois subtotais da Rescisão de um tipo (férias ou 13º) e o valor que o "Sim" lança como desconto. */
export interface ResumoAcumulado {
  /** Subtotal provisão: soma das provisões mensais salvas. */
  provisao: number;
  /** Subtotal desconto: soma dos descontos já lançados em OUTRAS competências (ver calcularAcumuladoLiquido). */
  desconto: number;
  /** O que o "Sim" lança como desconto da fatura: o Subtotal desconto; sem nenhum desconto lançado, o Subtotal provisão. */
  aLancar: number;
}

export interface AcumuladoLiquido {
  ferias: ResumoAcumulado;
  /** 13º (tipo "terco" em descontos_saldo). */
  terco: ResumoAcumulado;
}

function arredonda(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Prévia ↔ Folha do mesmo mês ("09/2026 (Folha)" -> "09/2026 (Prévia)"); null pra competência sem marcação (antiga). */
function competenciaPar(competencia: string): string | null {
  return trocarTipoCompetencia(competencia, "folha", "previa") ?? trocarTipoCompetencia(competencia, "previa", "folha");
}

function resumo(provisao: number, desconto: number): ResumoAcumulado {
  // O desconto da fatura é o Subtotal desconto — NÃO se abate o Subtotal provisão dele (provisão −
  // desconto dava um líquido que não é o valor a descontar, ex.: 282,53 − 1.899,69 = −1.617,16 em vez
  // de 1.899,69). Só quando ainda não há nenhum desconto lançado é que o Subtotal provisão serve de base.
  return { provisao: arredonda(provisao), desconto: arredonda(desconto), aLancar: arredonda(desconto > 0 ? desconto : provisao) };
}

/**
 * Subtotais da Rescisão de um colaborador e o valor que o "Sim" do Faturamento lança como desconto
 * na `competenciaAlvo`.
 *
 * O Subtotal desconto NÃO conta o desconto da própria `competenciaAlvo` (marcar "Sim" duas vezes dá o
 * mesmo valor, não soma o que ele mesmo já lançou) nem o da Prévia/Folha PAR dela: são o mesmo mês (a
 * Prévia é a cobrança antecipada e a Folha o fechamento, que já leva o desconto inteiro), então o
 * desconto de uma não é "já descontado" pra outra.
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
  return { ferias: resumo(provFerias, descFerias), terco: resumo(prov13, desc13) };
}
