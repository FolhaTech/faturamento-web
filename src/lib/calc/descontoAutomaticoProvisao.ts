import { listProvisoesMensaisPorMatricula } from "../repo/provisoesMensais";
import { upsertDescontoSaldo } from "../repo/descontosSaldo";
import { marcarDescontoProvisaoAplicado } from "../repo/colaboradores";
import type { EngineContext } from "./engine";
import type { Movimento } from "../types";

function competenciaParaData(competencia: string): Date {
  const [mes, ano] = competencia.replace(/\s*\((Prévia|Folha)\)$/, "").split("/");
  return new Date(Number(ano), Number(mes) - 1, 1);
}

function dataCompetenciaMaiorOuIgual(a: string, b: string): boolean {
  return competenciaParaData(a).getTime() >= competenciaParaData(b).getTime();
}

/**
 * Para colaboradores com as flags de desconto automático de provisão ativas, lança um desconto
 * de saldo na primeira competência processada em que ele aparece. O valor descontado é o
 * acumulado de Prov. Férias / Prov. 13º até aquela competência (inclusive), salvo em
 * provisoes_mensais. A competência aplicada é registrada no colaborador para não repetir o
 * desconto automaticamente enquanto a flag continuar "Sim".
 *
 * Chamado pelo motor de cálculo antes de gerar as linhas de desconto de saldo na fatura.
 */
export async function aplicarDescontoAutomaticoProvisao(movimentos: Movimento[], ctx: EngineContext): Promise<void> {
  const competencias = [...new Set(movimentos.map((m) => m.competencia))];
  if (competencias.length === 0) return;

  const matriculasPorCompetencia = new Map<string, Set<number>>();
  for (const m of movimentos) {
    const set = matriculasPorCompetencia.get(m.competencia) ?? new Set<number>();
    set.add(m.matricula);
    matriculasPorCompetencia.set(m.competencia, set);
  }

  for (const competencia of competencias) {
    const matriculas = [...(matriculasPorCompetencia.get(competencia) ?? [])];
    for (const matricula of matriculas) {
      const colaborador = ctx.colaboradoresPorMatricula.get(matricula);
      if (!colaborador) continue;

      const provisoes = await listProvisoesMensaisPorMatricula(matricula);

      if (colaborador.descontarProvFerias && colaborador.descontoProvFeriasCompetencia == null) {
        const acumulado = provisoes
          .filter((p) => dataCompetenciaMaiorOuIgual(competencia, p.competencia))
          .reduce((soma, p) => soma + p.provFerias, 0);
        if (acumulado > 0) {
          await upsertDescontoSaldo(matricula, competencia, "ferias", -acumulado);
          await marcarDescontoProvisaoAplicado(matricula, "ferias", competencia);
        }
      }

      if (colaborador.descontarProv13 && colaborador.descontoProv13Competencia == null) {
        const acumulado = provisoes
          .filter((p) => dataCompetenciaMaiorOuIgual(competencia, p.competencia))
          .reduce((soma, p) => soma + p.prov13, 0);
        if (acumulado > 0) {
          await upsertDescontoSaldo(matricula, competencia, "terco", -acumulado);
          await marcarDescontoProvisaoAplicado(matricula, "13", competencia);
        }
      }
    }
  }
}
