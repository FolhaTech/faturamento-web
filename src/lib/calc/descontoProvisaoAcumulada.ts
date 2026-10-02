import { listDescontosSaldoPorMatricula, listDescontosSaldoPorMatriculas, setDescontoSaldo, type DescontoSaldo } from "../repo/descontosSaldo";
import { listProvisoesMensaisPorMatricula, listProvisoesMensaisPorMatriculas, type ProvisaoMensal } from "../repo/provisoesMensais";
import type { TipoSaldoFerias } from "../types";
import { calcularAcumuladoLiquido, type AcumuladoLiquido } from "./acumuladoLiquido";

function agruparPorMatricula<T extends { matricula: number }>(itens: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of itens) {
    const arr = map.get(item.matricula) ?? [];
    arr.push(item);
    map.set(item.matricula, arr);
  }
  return map;
}

/** Acumulado líquido (ver calcularAcumuladoLiquido) de vários colaboradores, com duas consultas no total. */
export async function listarAcumuladoLiquido(matriculas: number[], competenciaAlvo: string): Promise<Map<number, AcumuladoLiquido>> {
  const [provisoes, descontos] = await Promise.all([listProvisoesMensaisPorMatriculas(matriculas), listDescontosSaldoPorMatriculas(matriculas)]);
  const provPorMatricula = agruparPorMatricula<ProvisaoMensal>(provisoes);
  const descPorMatricula = agruparPorMatricula<DescontoSaldo>(descontos);
  return new Map(matriculas.map((m) => [m, calcularAcumuladoLiquido(provPorMatricula.get(m) ?? [], descPorMatricula.get(m) ?? [], competenciaAlvo)]));
}

/**
 * Botões Sim/Não de Prov. Férias e Prov. 13º no detalhamento do colaborador no Faturamento.
 *
 * Sim: o valor "a lançar" (ver calcularAcumuladoLiquido — o Subtotal desconto da Rescisão, sem abater
 * o Subtotal provisão) vira o desconto dele NESSA competência, substituindo o que já estava lançado
 * pra esse tipo nela. Não: tira esse desconto do colaborador. O desconto entra na fatura pelo mesmo
 * caminho dos descontos de saldo (ver generateDescontoSaldoFeriasCharges em engine.ts). Retorna o
 * valor lançado (0 quando "Não" ou quando não há nada a lançar).
 */
export async function definirDescontoProvisao(matricula: number, competencia: string, tipo: TipoSaldoFerias, aplicar: boolean): Promise<number> {
  if (!aplicar) {
    await setDescontoSaldo(matricula, competencia, tipo, 0);
    return 0;
  }
  const [provisoes, descontos] = await Promise.all([listProvisoesMensaisPorMatricula(matricula), listDescontosSaldoPorMatricula(matricula)]);
  const acumulado = calcularAcumuladoLiquido(provisoes, descontos, competencia);
  const valor = acumulado[tipo].aLancar;
  await setDescontoSaldo(matricula, competencia, tipo, valor);
  return valor;
}
