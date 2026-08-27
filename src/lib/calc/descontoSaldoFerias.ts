import { upsertEncargo } from "../repo/encargos";
import { insertMovimentoAvulso, listCompetencias, type MovimentoInput } from "../repo/movimentos";
import type { Colaborador } from "../types";

/** Códigos reservados (fora da faixa usada pelo sistema de folha real) para os descontos sintéticos de saldo. */
export const CODIGO_DESCONTO_SALDO_FERIAS = 900001;
export const CODIGO_DESCONTO_SALDO_UM_TERCO = 900002;

async function garantirEncargosDeDesconto(): Promise<void> {
  await upsertEncargo({
    codigo: CODIGO_DESCONTO_SALDO_FERIAS,
    evento: "DESCONTO SALDO DE FÉRIAS",
    tipo: "P",
    inss655: 0,
    inss515: 0,
    fgts: 0,
    provFerias: 0,
    prov13: 0,
    abateSaldo: null,
  });
  await upsertEncargo({
    codigo: CODIGO_DESCONTO_SALDO_UM_TERCO,
    evento: "DESCONTO SALDO DE 1/3",
    tipo: "P",
    inss655: 0,
    inss515: 0,
    fgts: 0,
    provFerias: 0,
    prov13: 0,
    abateSaldo: null,
  });
}

/**
 * Lança saldoFerias/saldoUmTerco (quando > 0) como desconto — um lançamento avulso de valor
 * NEGATIVO por saldo, na competência mais recente já enviada — reduzindo de verdade o total
 * cobrado do tomador daquele colaborador (ver calculateLine em engine.ts: tipo "P" com valor
 * negativo passa negativo pela cadeia de base/taxa adm/NF inteira).
 *
 * Não mexe nos saldos em si — quem chama decide se/como zera depois (ver route.ts). Retorna a
 * competência usada, ou null se não havia nenhuma ainda (nada a lançar).
 *
 * Atenção: reenviar o arquivo da folha dessa competência mais tarde apaga esse lançamento
 * avulso junto com os demais (replaceMovimentosPorCompetencia substitui tudo).
 */
export async function lancarDescontoSaldoFerias(
  colaborador: Pick<Colaborador, "matricula" | "nome">,
  saldoFerias: number,
  saldoUmTerco: number,
): Promise<string | null> {
  if (saldoFerias <= 0 && saldoUmTerco <= 0) return null;

  const competencias = await listCompetencias();
  const competenciaAtual = competencias[0];
  if (!competenciaAtual) return null;

  await garantirEncargosDeDesconto();

  const base: Omit<MovimentoInput, "codigo" | "evento" | "valor"> = {
    matricula: colaborador.matricula,
    nome: colaborador.nome,
    competencia: competenciaAtual,
    ref: 0,
    tipo: "P",
    forma: "Valor",
  };

  if (saldoFerias > 0) {
    await insertMovimentoAvulso({ ...base, codigo: CODIGO_DESCONTO_SALDO_FERIAS, evento: "DESCONTO SALDO DE FÉRIAS", valor: -saldoFerias });
  }
  if (saldoUmTerco > 0) {
    await insertMovimentoAvulso({ ...base, codigo: CODIGO_DESCONTO_SALDO_UM_TERCO, evento: "DESCONTO SALDO DE 1/3", valor: -saldoUmTerco });
  }

  return competenciaAtual;
}
