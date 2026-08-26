import { ajustarSaldosFerias, getSaldosFerias } from "../repo/colaboradores";
import { listEncargos } from "../repo/encargos";
import { sumAbatimentoFeriasPorMatricula, type MovimentoInput } from "../repo/movimentos";

/**
 * Congela, no momento do upload, quanto de cada lançamento de férias/1/3 real
 * (código marcado com "Abate saldo férias" em Encargos) deve ser abatido do
 * saldo de férias do colaborador — em vez de cobrar o valor cheio de novo do
 * tomador (ver calculateLine em engine.ts).
 *
 * Reenviar o arquivo da mesma competência primeiro DEVOLVE ao saldo o que
 * tinha sido abatido pelo upload anterior dessas competências (senão reenviar
 * drenaria o saldo de novo a cada vez), e só então recalcula o abatimento em
 * cima do arquivo novo.
 */
export async function aplicarAbatimentoFerias(linhas: MovimentoInput[]): Promise<MovimentoInput[]> {
  const encargos = await listEncargos();
  const codigosAbate = new Set(encargos.filter((e) => e.abateSaldoFerias).map((e) => e.codigo));

  const competencias = [...new Set(linhas.map((l) => l.competencia))];
  const abatimentosAnteriores = await sumAbatimentoFeriasPorMatricula(competencias);
  if (abatimentosAnteriores.size > 0) {
    await ajustarSaldosFerias(abatimentosAnteriores);
  }

  const matriculasAfetadas = [...new Set(linhas.filter((l) => codigosAbate.has(l.codigo)).map((l) => l.matricula))];
  if (matriculasAfetadas.length === 0) return linhas;

  const saldos = await getSaldosFerias(matriculasAfetadas);
  const consumido = new Map<number, number>();

  const linhasAjustadas = linhas.map((l) => {
    if (!codigosAbate.has(l.codigo)) return l;
    const saldoRestante = (saldos.get(l.matricula) ?? 0) - (consumido.get(l.matricula) ?? 0);
    const abatimento = Math.max(0, Math.min(saldoRestante, l.valor));
    if (abatimento > 0) consumido.set(l.matricula, (consumido.get(l.matricula) ?? 0) + abatimento);
    return { ...l, abatimentoFerias: abatimento };
  });

  if (consumido.size > 0) {
    const deltas = new Map<number, number>();
    for (const [matricula, valor] of consumido) deltas.set(matricula, -valor);
    await ajustarSaldosFerias(deltas);
  }

  return linhasAjustadas;
}
