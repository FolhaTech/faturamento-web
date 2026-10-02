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
 * Sim: o Acumulado líquido atual do colaborador vira o desconto dele NESSA competência (substitui o
 * que já estava lançado pra esse tipo nela) — o valor que a tela mostra, em módulo: o líquido da
 * Rescisão aparece negativo quando os descontos já lançados superam as provisões salvas, e mesmo
 * assim é esse número que o usuário quer descontado. Não: tira esse desconto do colaborador. O
 * desconto entra na fatura pelo mesmo caminho dos descontos de saldo (ver
 * generateDescontoSaldoFeriasCharges em engine.ts). Retorna o valor lançado (0 quando "Não" ou
 * quando o acumulado líquido é exatamente zero).
 */
export async function definirDescontoProvisao(matricula: number, competencia: string, tipo: TipoSaldoFerias, aplicar: boolean): Promise<number> {
  if (!aplicar) {
    await setDescontoSaldo(matricula, competencia, tipo, 0);
    return 0;
  }
  const [provisoes, descontos] = await Promise.all([listProvisoesMensaisPorMatricula(matricula), listDescontosSaldoPorMatricula(matricula)]);
  const acumulado = calcularAcumuladoLiquido(provisoes, descontos, competencia);
  const valor = Math.abs(acumulado[tipo]);
  await setDescontoSaldo(matricula, competencia, tipo, valor);
  return valor;
}
