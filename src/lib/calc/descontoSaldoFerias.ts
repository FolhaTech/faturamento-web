import { upsertDescontoSaldo } from "../repo/descontosSaldo";
import { upsertEncargo } from "../repo/encargos";
import { listCompetencias } from "../repo/movimentos";
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
 * Lança saldoFerias/saldoUmTerco (quando > 0) como desconto — valor NEGATIVO gravado em
 * descontos_saldo (matrícula + competência mais recente já enviada + tipo), reduzindo de
 * verdade o total cobrado do tomador daquele colaborador (ver generateDescontoSaldoFeriasCharges
 * em engine.ts: gerado a cada cálculo a partir dessa tabela, não de uma linha em Movimentos —
 * por isso sobrevive a reenvios do arquivo daquela competência, diferente do antigo lançamento
 * avulso em Movimentos).
 *
 * Não mexe nos saldos em si — quem chama decide se/como zera depois (ver route.ts). Retorna a
 * competência usada, ou null se não havia nenhuma ainda (nada a lançar).
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

  if (saldoFerias > 0) {
    await upsertDescontoSaldo(colaborador.matricula, competenciaAtual, "ferias", -saldoFerias);
  }
  if (saldoUmTerco > 0) {
    await upsertDescontoSaldo(colaborador.matricula, competenciaAtual, "terco", -saldoUmTerco);
  }

  return competenciaAtual;
}
