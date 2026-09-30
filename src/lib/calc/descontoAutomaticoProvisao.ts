import { listProvisoesMensaisPorMatriculas } from "../repo/provisoesMensais";
import { setDescontosSaldoEmLote } from "../repo/descontosSaldo";
import { marcarDescontosProvisaoAplicadosEmLote } from "../repo/colaboradores";
import type { EngineContext } from "./engine";
import type { Colaborador, Movimento } from "../types";

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
 * Implementação otimizada: busca provisões em lote e faz no máximo 3 escritas no banco por
 * competência (insert/update descontos, update colaboradores, uma pra cada tipo).
 */
export async function aplicarDescontoAutomaticoProvisao(movimentos: Movimento[], ctx: EngineContext): Promise<void> {
  const competencias = [...new Set(movimentos.map((m) => m.competencia))];
  if (competencias.length === 0) return;

  const temAlgumCandidato = [...ctx.colaboradoresPorMatricula.values()].some(
    (c) =>
      (c.descontarProvFerias && c.descontoProvFeriasCompetencia == null) ||
      (c.descontarProv13 && c.descontoProv13Competencia == null),
  );
  if (!temAlgumCandidato) return;

  console.log(`[descontoAutomatico] processando ${competencias.length} competência(s) com ${movimentos.length} movimento(s)`);

  const matriculasPorCompetencia = new Map<string, Set<number>>();
  for (const m of movimentos) {
    const set = matriculasPorCompetencia.get(m.competencia) ?? new Set<number>();
    set.add(m.matricula);
    matriculasPorCompetencia.set(m.competencia, set);
  }

  for (const competencia of competencias) {
    const matriculas = [...(matriculasPorCompetencia.get(competencia) ?? [])];
    const candidatos: { matricula: number; colaborador: Colaborador }[] = [];
    for (const matricula of matriculas) {
      const colaborador = ctx.colaboradoresPorMatricula.get(matricula);
      if (
        colaborador &&
        ((colaborador.descontarProvFerias && colaborador.descontoProvFeriasCompetencia == null) ||
          (colaborador.descontarProv13 && colaborador.descontoProv13Competencia == null))
      ) {
        candidatos.push({ matricula, colaborador });
      }
    }

    if (candidatos.length === 0) continue;

    const provisoes = await listProvisoesMensaisPorMatriculas(candidatos.map((c) => c.matricula));
    const provisoesPorMatricula = new Map<number, typeof provisoes>();
    for (const p of provisoes) {
      const arr = provisoesPorMatricula.get(p.matricula) ?? [];
      arr.push(p);
      provisoesPorMatricula.set(p.matricula, arr);
    }

    const descontosLote: { matricula: number; competencia: string; tipo: "ferias" | "terco"; valorAbsoluto: number }[] = [];
    const marcarLote: { matricula: number; tipo: "ferias" | "13"; competencia: string }[] = [];

    for (const { matricula, colaborador } of candidatos) {
      const provisoesDoColaborador = provisoesPorMatricula.get(matricula) ?? [];
      const ateCompetencia = provisoesDoColaborador.filter((p) => dataCompetenciaMaiorOuIgual(competencia, p.competencia));

      if (colaborador.descontarProvFerias && colaborador.descontoProvFeriasCompetencia == null) {
        const acumulado = ateCompetencia.reduce((soma, p) => soma + p.provFerias, 0);
        if (acumulado > 0) {
          descontosLote.push({ matricula, competencia, tipo: "ferias", valorAbsoluto: acumulado });
          marcarLote.push({ matricula, tipo: "ferias", competencia });
        }
      }

      if (colaborador.descontarProv13 && colaborador.descontoProv13Competencia == null) {
        const acumulado = ateCompetencia.reduce((soma, p) => soma + p.prov13, 0);
        if (acumulado > 0) {
          descontosLote.push({ matricula, competencia, tipo: "terco", valorAbsoluto: acumulado });
          marcarLote.push({ matricula, tipo: "13", competencia });
        }
      }
    }

    if (descontosLote.length > 0) await setDescontosSaldoEmLote(descontosLote);
    if (marcarLote.length > 0) await marcarDescontosProvisaoAplicadosEmLote(marcarLote);
  }
}
