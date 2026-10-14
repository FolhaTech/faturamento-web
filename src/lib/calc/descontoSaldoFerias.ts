import { upsertDescontoSaldo, type TipoDescontoSaldo } from "../repo/descontosSaldo";
import { upsertEncargo } from "../repo/encargos";
import type { Colaborador } from "../types";

/** Códigos reservados (fora da faixa usada pelo sistema de folha real) para os descontos sintéticos de saldo. */
export const CODIGO_DESCONTO_SALDO_FERIAS = 900001;
export const CODIGO_DESCONTO_SALDO_UM_TERCO = 900002;
/** Desconto de aviso prévio do colaborador (ver tela do colaborador) — lançado na fatura igual aos de saldo, mas sem saldo nem provisão. */
export const CODIGO_DESCONTO_AVISO_PREVIO = 900003;
export const EVENTO_DESCONTO_AVISO_PREVIO = "DESCONTO AVISO PRÉVIO";

/** Código e nome do evento sintético de cada tipo de desconto lançado na tela do colaborador (férias, 13º ou aviso prévio) — ver generateDescontoSaldoFeriasCharges em engine.ts. */
export function eventoDoDescontoSaldo(tipo: TipoDescontoSaldo): { codigo: number; evento: string } {
  if (tipo === "ferias") return { codigo: CODIGO_DESCONTO_SALDO_FERIAS, evento: "DESCONTO SALDO DE FÉRIAS" };
  if (tipo === "aviso") return { codigo: CODIGO_DESCONTO_AVISO_PREVIO, evento: EVENTO_DESCONTO_AVISO_PREVIO };
  return { codigo: CODIGO_DESCONTO_SALDO_UM_TERCO, evento: "DESCONTO SALDO DE 13° SALÁRIO" };
}

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
    evento: "DESCONTO SALDO DE 13° SALÁRIO",
    tipo: "P",
    inss655: 0,
    inss515: 0,
    fgts: 0,
    provFerias: 0,
    prov13: 0,
    abateSaldo: null,
  });
  await upsertEncargo({
    codigo: CODIGO_DESCONTO_AVISO_PREVIO,
    evento: EVENTO_DESCONTO_AVISO_PREVIO,
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
 * Lança saldoFerias/saldoUmTerco (quando > 0) como desconto NA COMPETÊNCIA ESCOLHIDA (não mais
 * "a mais recente do sistema" — quem chama decide, ver tela do colaborador) — valor NEGATIVO
 * gravado em descontos_saldo (matrícula + competência + tipo), reduzindo de verdade o total
 * cobrado do tomador daquele colaborador NAQUELE MÊS específico (ver
 * generateDescontoSaldoFeriasCharges em engine.ts: gerado a cada cálculo a partir dessa tabela,
 * não de uma linha em Movimentos — por isso sobrevive a reenvios do arquivo daquela competência).
 * Cada competência acumula seu próprio valor lançado, sem replicar pras outras (ver
 * upsertDescontoSaldo).
 *
 * O aviso prévio (`avisoPrevio`, quando > 0) é lançado do mesmo jeito, como um terceiro desconto
 * ("aviso" em descontos_saldo): o valor digitado reduz a NF do colaborador naquela competência.
 *
 * Não mexe nos saldos em si — quem chama decide se/como zera depois (ver route.ts). Retorna true
 * se algo foi lançado (false quando os valores são todos <= 0, nada a fazer).
 */
export async function lancarDescontoSaldoFerias(
  colaborador: Pick<Colaborador, "matricula" | "nome">,
  competenciaAlvo: string,
  saldoFerias: number,
  saldoUmTerco: number,
  avisoPrevio = 0,
): Promise<boolean> {
  if (saldoFerias <= 0 && saldoUmTerco <= 0 && avisoPrevio <= 0) return false;

  await garantirEncargosDeDesconto();

  if (saldoFerias > 0) {
    await upsertDescontoSaldo(colaborador.matricula, competenciaAlvo, "ferias", -saldoFerias);
  }
  if (saldoUmTerco > 0) {
    await upsertDescontoSaldo(colaborador.matricula, competenciaAlvo, "terco", -saldoUmTerco);
  }
  if (avisoPrevio > 0) {
    await upsertDescontoSaldo(colaborador.matricula, competenciaAlvo, "aviso", -avisoPrevio);
  }

  return true;
}
