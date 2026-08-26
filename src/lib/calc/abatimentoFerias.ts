import { ajustarSaldos, getSaldos } from "../repo/colaboradores";
import { listEncargos } from "../repo/encargos";
import { sumSaldoConsumidoPorMatriculaETipo, type MovimentoInput } from "../repo/movimentos";
import type { TipoSaldoFerias } from "../types";

const TIPOS: TipoSaldoFerias[] = ["ferias", "terco"];

/**
 * Congela, no momento do upload, quanto de cada lançamento de férias/1/3 real (código
 * marcado em Encargos com "Abate saldo" = Férias ou 1/3) deve ser abatido do saldo
 * CORRESPONDENTE do colaborador — em vez de cobrar o valor cheio de novo do tomador
 * (ver calculateLine em engine.ts). Férias e 1/3 são abatidos de saldos separados.
 *
 * Quando o valor real do pagamento ULTRAPASSA o saldo disponível, o excedente vira um
 * CRÉDITO negativo na fatura daquela linha (em vez de cobrar a diferença do tomador) —
 * ex.: saldo R$1.000, pagamento real R$2.000 -> cobrado do tomador = -R$1.000. O saldo do
 * colaborador é consumido até zero (nunca fica negativo); quem "sobra" do pagamento vira
 * o crédito, não uma dívida do colaborador.
 *
 * Reenviar o arquivo da mesma competência primeiro DEVOLVE a cada saldo o que tinha sido
 * REALMENTE consumido pelo upload anterior dessas competências (não o valor "congelado" da
 * fatura, que pode ser maior que o saldo — ver saldo_consumido em db.ts), e só então
 * recalcula o abatimento em cima do arquivo novo.
 */
export async function aplicarAbatimentoFerias(linhas: MovimentoInput[]): Promise<MovimentoInput[]> {
  const encargos = await listEncargos();
  const codigoParaTipo = new Map<number, TipoSaldoFerias>();
  for (const e of encargos) {
    if (e.abateSaldo) codigoParaTipo.set(e.codigo, e.abateSaldo);
  }

  const competencias = [...new Set(linhas.map((l) => l.competencia))];
  const consumoAnterior = await sumSaldoConsumidoPorMatriculaETipo(competencias);
  for (const tipo of TIPOS) {
    if (consumoAnterior[tipo].size > 0) {
      await ajustarSaldos(tipo, consumoAnterior[tipo]);
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

  const ajustesPorLinha = new Map<
    MovimentoInput,
    { abatimentoFerias: number; abatimentoSaldoTipo: TipoSaldoFerias; saldoConsumido: number }
  >();

  for (const tipo of TIPOS) {
    const linhasDoTipo = linhasPorTipo.get(tipo);
    if (!linhasDoTipo || linhasDoTipo.length === 0) continue;

    const matriculas = [...new Set(linhasDoTipo.map((l) => l.matricula))];
    const saldos = await getSaldos(tipo, matriculas);
    const consumidoAteAgora = new Map<number, number>();

    for (const l of linhasDoTipo) {
      const saldoRestante = (saldos.get(l.matricula) ?? 0) - (consumidoAteAgora.get(l.matricula) ?? 0);
      const consumo = Math.max(0, Math.min(saldoRestante, l.valor));
      const excedente = Math.max(0, l.valor - saldoRestante);
      const cobradoDoTomador = -excedente; // 0 quando o saldo cobre tudo; negativo (crédito) quando não cobre
      const abatimentoFerias = l.valor - cobradoDoTomador; // engine.ts faz valor - abatimentoFerias = cobradoDoTomador

      if (consumo > 0) consumidoAteAgora.set(l.matricula, (consumidoAteAgora.get(l.matricula) ?? 0) + consumo);
      if (abatimentoFerias !== 0) {
        ajustesPorLinha.set(l, { abatimentoFerias, abatimentoSaldoTipo: tipo, saldoConsumido: consumo });
      }
    }

    if (consumidoAteAgora.size > 0) {
      const deltas = new Map<number, number>();
      for (const [matricula, valor] of consumidoAteAgora) deltas.set(matricula, -valor);
      await ajustarSaldos(tipo, deltas);
    }
  }

  return linhas.map((l) => {
    const ajuste = ajustesPorLinha.get(l);
    return ajuste ? { ...l, ...ajuste } : l;
  });
}
