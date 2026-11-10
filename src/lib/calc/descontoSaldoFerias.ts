import { upsertDescontoSaldo, type TipoDescontoSaldo } from "../repo/descontosSaldo";
import { upsertEncargo } from "../repo/encargos";
import type { Colaborador } from "../types";

/** Códigos reservados (fora da faixa usada pelo sistema de folha real) para os descontos sintéticos de saldo. */
export const CODIGO_DESCONTO_SALDO_FERIAS = 900001;
export const CODIGO_DESCONTO_SALDO_UM_TERCO = 900002;
/** Aviso prévio lançado na ficha do colaborador (provisão lançada) — mesma cadeia dos de férias e 13º, sem saldo pendente. */
export const CODIGO_DESCONTO_AVISO_PREVIO = 900003;
export const EVENTO_DESCONTO_AVISO_PREVIO = "DESCONTO AVISO PRÉVIO";

/** Nome do evento do que é lançado à mão na ficha do colaborador: PROVISÃO (cobrada na fatura e somada na Rescisão). */
export const EVENTO_PROVISAO_LANCADA: Record<TipoDescontoSaldo, string> = {
  ferias: "PROVISÃO LANÇADA DE FÉRIAS",
  terco: "PROVISÃO LANÇADA DE 13° SALÁRIO",
  aviso: "PROVISÃO LANÇADA DE AVISO PRÉVIO",
};

/** Nome do evento do crédito que a reserva da Folha lança (desconto, valor negativo) — "Aplicar" na consulta de reservas. */
const EVENTO_DESCONTO: Record<TipoDescontoSaldo, string> = {
  ferias: "DESCONTO SALDO DE FÉRIAS",
  terco: "DESCONTO SALDO DE 13° SALÁRIO",
  aviso: EVENTO_DESCONTO_AVISO_PREVIO,
};

/**
 * Código e nome do evento sintético de cada tipo lançado na tela do colaborador (férias, 13º ou aviso prévio) — ver
 * generateDescontoSaldoFeriasCharges em engine.ts. `provisao` = true é o que se digita na ficha (provisão lançada, positiva); false é o
 * crédito da reserva da Folha (desconto).
 */
export function eventoDoDescontoSaldo(tipo: TipoDescontoSaldo, provisao = false): { codigo: number; evento: string } {
  const evento = (provisao ? EVENTO_PROVISAO_LANCADA : EVENTO_DESCONTO)[tipo];
  if (tipo === "ferias") return { codigo: CODIGO_DESCONTO_SALDO_FERIAS, evento };
  if (tipo === "aviso") return { codigo: CODIGO_DESCONTO_AVISO_PREVIO, evento };
  return { codigo: CODIGO_DESCONTO_SALDO_UM_TERCO, evento };
}

async function garantirEncargosDeProvisao(): Promise<void> {
  await upsertEncargo({
    codigo: CODIGO_DESCONTO_SALDO_FERIAS,
    evento: EVENTO_PROVISAO_LANCADA.ferias,
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
    evento: EVENTO_PROVISAO_LANCADA.terco,
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
    evento: EVENTO_PROVISAO_LANCADA.aviso,
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
 * Lança saldoFerias/saldoUmTerco (quando > 0) como PROVISÃO NA COMPETÊNCIA ESCOLHIDA (quem chama decide, ver tela do colaborador) — valor
 * POSITIVO gravado em descontos_saldo (matrícula + competência + tipo): entra na fatura daquele colaborador NAQUELE MÊS como cobrança
 * (ver generateDescontoSaldoFeriasCharges em engine.ts: gerado a cada cálculo a partir dessa tabela, não de uma linha em Movimentos —
 * por isso sobrevive a reenvios do arquivo daquela competência) e soma na "Rescisão — provisão acumulada", mês a mês. Cada competência
 * acumula seu próprio valor lançado, sem replicar pras outras (ver upsertDescontoSaldo).
 *
 * O aviso prévio (`avisoPrevio`, quando > 0) é lançado do mesmo jeito, como uma terceira provisão ("aviso" em descontos_saldo).
 *
 * Não mexe nos saldos em si — quem chama decide se/como zera depois (ver route.ts). Retorna true
 * se algo foi lançado (false quando os valores são todos <= 0, nada a fazer).
 */
export async function lancarProvisaoSaldo(
  colaborador: Pick<Colaborador, "matricula" | "nome">,
  competenciaAlvo: string,
  saldoFerias: number,
  saldoUmTerco: number,
  avisoPrevio = 0,
): Promise<boolean> {
  if (saldoFerias <= 0 && saldoUmTerco <= 0 && avisoPrevio <= 0) return false;

  await garantirEncargosDeProvisao();

  if (saldoFerias > 0) {
    await upsertDescontoSaldo(colaborador.matricula, competenciaAlvo, "ferias", saldoFerias);
  }
  if (saldoUmTerco > 0) {
    await upsertDescontoSaldo(colaborador.matricula, competenciaAlvo, "terco", saldoUmTerco);
  }
  if (avisoPrevio > 0) {
    await upsertDescontoSaldo(colaborador.matricula, competenciaAlvo, "aviso", avisoPrevio);
  }

  return true;
}
