import { listProvisoesMensaisPorMatriculas } from "../repo/provisoesMensais";
import { setDescontosSaldoEmLote, listDescontosSaldoPorMatricula } from "../repo/descontosSaldo";
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
  console.log(`[descontoAutomatico] INICIANDO - ${movimentos.length} movimento(s), ${ctx.colaboradoresPorMatricula.size} colaborador(es) no contexto`);
  
  const competencias = [...new Set(movimentos.map((m) => m.competencia))];
  if (competencias.length === 0) {
    console.log(`[descontoAutomatico] Nenhuma competência encontrada, abortando`);
    return;
  }

  const colaboradoresComFlag = [...ctx.colaboradoresPorMatricula.values()].filter(
    (c) => c.descontarProvFerias || c.descontarProv13
  );
  console.log(`[descontoAutomatico] ${colaboradoresComFlag.length} colaborador(es) com flag ativa`);
  
  const temAlgumCandidato = colaboradoresComFlag.some(
    (c) =>
      (c.descontarProvFerias && c.descontoProvFeriasCompetencia == null) ||
      (c.descontarProv13 && c.descontoProv13Competencia == null),
  );
  if (!temAlgumCandidato) {
    console.log(`[descontoAutomatico] Nenhum candidato encontrado (todos já aplicados ou sem flag), abortando`);
    return;
  }

  console.log(`[descontoAutomatico] processando ${competencias.length} competência(s) com ${movimentos.length} movimento(s)`);

  const matriculasPorCompetencia = new Map<string, Set<number>>();
  for (const m of movimentos) {
    const set = matriculasPorCompetencia.get(m.competencia) ?? new Set<number>();
    set.add(m.matricula);
    matriculasPorCompetencia.set(m.competencia, set);
  }

  for (const competencia of competencias) {
    console.log(`[descontoAutomatico] Processando competência: ${competencia}`);
    const matriculas = [...(matriculasPorCompetencia.get(competencia) ?? [])];
    console.log(`[descontoAutomatico] ${matriculas.length} matrícula(s) nesta competência`);
    
    const candidatos: { matricula: number; colaborador: Colaborador }[] = [];
    for (const matricula of matriculas) {
      const colaborador = ctx.colaboradoresPorMatricula.get(matricula);
      if (
        colaborador &&
        ((colaborador.descontarProvFerias && colaborador.descontoProvFeriasCompetencia == null) ||
          (colaborador.descontarProv13 && colaborador.descontoProv13Competencia == null))
      ) {
        console.log(`[descontoAutomatico] Matrícula ${matricula} é candidata: descontarProvFerias=${colaborador.descontarProvFerias}, descontoProvFeriasCompetencia=${colaborador.descontoProvFeriasCompetencia}, descontarProv13=${colaborador.descontarProv13}, descontoProv13Competencia=${colaborador.descontoProv13Competencia}`);
        candidatos.push({ matricula, colaborador });
      }
    }

    if (candidatos.length === 0) {
      console.log(`[descontoAutomatico] Nenhum candidato nesta competência, pulando`);
      continue;
    }

    console.log(`[descontoAutomatico] ${candidatos.length} candidato(s) encontrado(s)`);

    const provisoes = await listProvisoesMensaisPorMatriculas(candidatos.map((c) => c.matricula));
    console.log(`[descontoAutomatico] ${provisoes.length} provisão(ões) encontrada(s) para os candidatos`);
    const provisoesPorMatricula = new Map<number, typeof provisoes>();
    for (const p of provisoes) {
      const arr = provisoesPorMatricula.get(p.matricula) ?? [];
      arr.push(p);
      provisoesPorMatricula.set(p.matricula, arr);
    }

    const descontosJaLancados = await Promise.all(
      candidatos.map((c) => listDescontosSaldoPorMatricula(c.matricula)),
    );
    const descontosPorMatricula = new Map<number, typeof descontosJaLancados[number]>();
    for (let i = 0; i < candidatos.length; i++) {
      descontosPorMatricula.set(candidatos[i].matricula, descontosJaLancados[i]);
    }

    const descontosLote: { matricula: number; competencia: string; tipo: "ferias" | "terco"; valorAbsoluto: number }[] = [];
    const marcarLote: { matricula: number; tipo: "ferias" | "13"; competencia: string }[] = [];

    for (const { matricula, colaborador } of candidatos) {
      console.log(`[descontoAutomatico] Analisando matrícula ${matricula}: descontarProvFerias=${colaborador.descontarProvFerias}, descontarProv13=${colaborador.descontarProv13}`);
      
      const provisoesDoColaborador = provisoesPorMatricula.get(matricula) ?? [];
      console.log(`[descontoAutomatico] Matrícula ${matricula}: ${provisoesDoColaborador.length} provisão(ões) encontrada(s)`);
      
      const ateCompetencia = provisoesDoColaborador.filter((p) => dataCompetenciaMaiorOuIgual(competencia, p.competencia));
      console.log(`[descontoAutomatico] Matrícula ${matricula}: ${ateCompetencia.length} provisão(ões) até competência ${competencia}`);

      const descontosDoColaborador = descontosPorMatricula.get(matricula) ?? [];
      console.log(`[descontoAutomatico] Matrícula ${matricula}: ${descontosDoColaborador.length} desconto(s) já lançado(s)`);
      
      const totalDescontosFerias = descontosDoColaborador
        .filter((d) => d.tipo === "ferias")
        .reduce((soma, d) => soma + Math.abs(d.valor), 0);
      const totalDescontos13 = descontosDoColaborador
        .filter((d) => d.tipo === "terco")
        .reduce((soma, d) => soma + Math.abs(d.valor), 0);

      if (colaborador.descontarProvFerias && colaborador.descontoProvFeriasCompetencia == null) {
        const acumulado = ateCompetencia.reduce((soma, p) => soma + p.provFerias, 0);
        const liquido = acumulado - totalDescontosFerias;
        console.log(`[descontoAutomatico] Matrícula ${matricula}: provFerias acumulado=${acumulado.toFixed(2)}, descontos=${totalDescontosFerias.toFixed(2)}, líquido=${liquido.toFixed(2)}`);
        if (liquido > 0) {
          console.log(`[descontoAutomatico] ✓ Matrícula ${matricula}: provFerias líquido=${liquido.toFixed(2)} > 0, criando desconto`);
          descontosLote.push({ matricula, competencia, tipo: "ferias", valorAbsoluto: liquido });
          marcarLote.push({ matricula, tipo: "ferias", competencia });
        } else {
          console.log(`[descontoAutomatico] ✗ Matrícula ${matricula}: provFerias líquido=${liquido.toFixed(2)} <= 0, não criando desconto`);
        }
      } else {
        console.log(`[descontoAutomatico] Matrícula ${matricula}: não elegível para desconto de férias (flag=${colaborador.descontarProvFerias}, competencia=${colaborador.descontoProvFeriasCompetencia})`);
      }

      if (colaborador.descontarProv13 && colaborador.descontoProv13Competencia == null) {
        const acumulado = ateCompetencia.reduce((soma, p) => soma + p.prov13, 0);
        const liquido = acumulado - totalDescontos13;
        console.log(`[descontoAutomatico] Matrícula ${matricula}: prov13 acumulado=${acumulado.toFixed(2)}, descontos=${totalDescontos13.toFixed(2)}, líquido=${liquido.toFixed(2)}`);
        if (liquido > 0) {
          console.log(`[descontoAutomatico] ✓ Matrícula ${matricula}: prov13 líquido=${liquido.toFixed(2)} > 0, criando desconto`);
          descontosLote.push({ matricula, competencia, tipo: "terco", valorAbsoluto: liquido });
          marcarLote.push({ matricula, tipo: "13", competencia });
        } else {
          console.log(`[descontoAutomatico] ✗ Matrícula ${matricula}: prov13 líquido=${liquido.toFixed(2)} <= 0, não criando desconto`);
        }
      } else {
        console.log(`[descontoAutomatico] Matrícula ${matricula}: não elegível para desconto de 13º (flag=${colaborador.descontarProv13}, competencia=${colaborador.descontoProv13Competencia})`);
      }
    }

    if (descontosLote.length > 0) {
      console.log(`[descontoAutomatico] ✓ Criando ${descontosLote.length} desconto(s) na competência ${competencia}:`, descontosLote);
      await setDescontosSaldoEmLote(descontosLote);
      console.log(`[descontoAutomatico] ✓ Descontos criados com sucesso`);
    } else {
      console.log(`[descontoAutomatico] ✗ Nenhum desconto criado nesta competência`);
    }
    
    if (marcarLote.length > 0) {
      console.log(`[descontoAutomatico] ✓ Marcando ${marcarLote.length} flag(s) como aplicadas na competência ${competencia}`);
      await marcarDescontosProvisaoAplicadosEmLote(marcarLote);
      console.log(`[descontoAutomatico] ✓ Flags marcadas com sucesso`);
    }
  }
  
  console.log(`[descontoAutomatico] FINALIZADO`);
}
