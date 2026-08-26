import { ajustarSaldos, getSaldos } from "../repo/colaboradores";
import { listEncargos } from "../repo/encargos";
import { sumAbatimentoPorMatriculaETipo, type MovimentoInput } from "../repo/movimentos";
import type { TipoSaldoFerias } from "../types";

const TIPOS: TipoSaldoFerias[] = ["ferias", "terco"];

/**
 * Congela, no momento do upload, quanto de cada lançamento de férias/1/3 real (código
 * marcado em Encargos com "Abate saldo" = Férias ou 1/3) deve ser abatido do saldo
 * CORRESPONDENTE do colaborador — em vez de cobrar o valor cheio de novo do tomador
 * (ver calculateLine em engine.ts). Férias e 1/3 são abatidos de saldos separados.
 *
 * Reenviar o arquivo da mesma competência primeiro DEVOLVE a cada saldo o que tinha sido
 * abatido pelo upload anterior dessas competências (senão reenviar drenaria os saldos de
 * novo a cada vez), e só então recalcula o abatimento em cima do arquivo novo.
 */
export async function aplicarAbatimentoFerias(linhas: MovimentoInput[]): Promise<MovimentoInput[]> {
  const encargos = await listEncargos();
  const codigoParaTipo = new Map<number, TipoSaldoFerias>();
  for (const e of encargos) {
    if (e.abateSaldo) codigoParaTipo.set(e.codigo, e.abateSaldo);
  }

  const competencias = [...new Set(linhas.map((l) => l.competencia))];
  const abatimentosAnteriores = await sumAbatimentoPorMatriculaETipo(competencias);
  for (const tipo of TIPOS) {
    if (abatimentosAnteriores[tipo].size > 0) {
      await ajustarSaldos(tipo, abatimentosAnteriores[tipo]);
    }
  }

  const linhasPorTipo = new Map<TipoSaldoFerias, MovimentoInput[]>();
  for (const l of linhas) {
    const tipo = codigoParaTipo.get(l.codigo);
    if (!tipo) continue;
    const arr = linhasPorTipo.get(tipo) ?? [];
    arr.push(l);
    linhasPorTipo.set(tipo, arr);
  }
  if (linhasPorTipo.size === 0) return linhas;

  const ajustesPorLinha = new Map<MovimentoInput, { abatimentoFerias: number; abatimentoSaldoTipo: TipoSaldoFerias }>();

  for (const tipo of TIPOS) {
    const linhasDoTipo = linhasPorTipo.get(tipo);
    if (!linhasDoTipo || linhasDoTipo.length === 0) continue;

    const matriculas = [...new Set(linhasDoTipo.map((l) => l.matricula))];
    const saldos = await getSaldos(tipo, matriculas);
    const consumido = new Map<number, number>();

    for (const l of linhasDoTipo) {
      const saldoRestante = (saldos.get(l.matricula) ?? 0) - (consumido.get(l.matricula) ?? 0);
      const abatimento = Math.max(0, Math.min(saldoRestante, l.valor));
      if (abatimento > 0) {
        consumido.set(l.matricula, (consumido.get(l.matricula) ?? 0) + abatimento);
        ajustesPorLinha.set(l, { abatimentoFerias: abatimento, abatimentoSaldoTipo: tipo });
      }
    }

    if (consumido.size > 0) {
      const deltas = new Map<number, number>();
      for (const [matricula, valor] of consumido) deltas.set(matricula, -valor);
      await ajustarSaldos(tipo, deltas);
    }
  }

  return linhas.map((l) => {
    const ajuste = ajustesPorLinha.get(l);
    return ajuste ? { ...l, ...ajuste } : l;
  });
}
