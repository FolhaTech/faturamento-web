import { ensureSchema, getDb } from "../db";
import type { Encargo, TipoEvento, TipoSaldoFerias } from "../types";

interface Row {
  codigo: number;
  evento: string;
  tipo: string;
  inss_655: number;
  inss_515: number;
  fgts: number;
  prov_ferias: number;
  prov_13: number;
  abate_saldo: string | null;
}

function toEncargo(row: Row): Encargo {
  return {
    codigo: row.codigo,
    evento: row.evento,
    tipo: row.tipo as TipoEvento,
    inss655: row.inss_655,
    inss515: row.inss_515,
    fgts: row.fgts,
    provFerias: row.prov_ferias,
    prov13: row.prov_13,
    abateSaldo: (row.abate_saldo as TipoSaldoFerias | null) ?? null,
  };
}

export async function listEncargos(): Promise<Encargo[]> {
  await ensureSchema();
  const rows = await getDb()<Row[]>`SELECT * FROM encargos ORDER BY evento`;
  return rows.map(toEncargo);
}

export async function getEncargo(codigo: number): Promise<Encargo | null> {
  await ensureSchema();
  const rows = await getDb()<Row[]>`SELECT * FROM encargos WHERE codigo = ${codigo}`;
  return rows[0] ? toEncargo(rows[0]) : null;
}

export interface EncargoInput {
  codigo: number;
  evento: string;
  tipo: TipoEvento;
  inss655: number;
  inss515: number;
  fgts: number;
  provFerias: number;
  prov13: number;
  abateSaldo: TipoSaldoFerias | null;
}

export async function upsertEncargo(input: EncargoInput): Promise<Encargo> {
  await ensureSchema();
  await getDb()`
    INSERT INTO encargos (codigo, evento, tipo, inss_655, inss_515, fgts, prov_ferias, prov_13, abate_saldo)
    VALUES (${input.codigo}, ${input.evento}, ${input.tipo}, ${input.inss655}, ${input.inss515}, ${input.fgts}, ${input.provFerias}, ${input.prov13}, ${input.abateSaldo})
    ON CONFLICT (codigo) DO UPDATE SET
      evento = excluded.evento, tipo = excluded.tipo, inss_655 = excluded.inss_655,
      inss_515 = excluded.inss_515, fgts = excluded.fgts, prov_ferias = excluded.prov_ferias, prov_13 = excluded.prov_13,
      abate_saldo = excluded.abate_saldo
  `;
  return (await getEncargo(input.codigo))!;
}

/**
 * Alíquotas padrão de INSS/FGTS/Provisões — as mesmas usadas em DIAS NORMAIS (código 8781),
 * confirmadas batendo com a folha real. Usadas pelos checkboxes de componentes da tela de
 * Faturamento (ver updateEncargoComponentes) — "ligar" um componente aplica esse valor de
 * referência; "desligar" zera.
 */
export const INSS_515_PADRAO = 0.288;
export const INSS_655_PADRAO = 0.255;
export const FGTS_PADRAO = 0.08;
export const PROV_FERIAS_PADRAO = 0.11110833333333332;
export const PROV_13_PADRAO = 0.08333333333333333;

export interface EncargoComponentes {
  inss: boolean;
  fgts: boolean;
  provisoes: boolean;
}

/**
 * Liga/desliga em bloco os componentes (INSS, FGTS, Provisões) de um evento, usando as
 * alíquotas padrão — usado pelos checkboxes rápidos da tela de Faturamento, que não exigem que
 * o usuário saiba os percentuais exatos de cor. Cria o Encargo (tipo "P") se ainda não existir
 * — caso comum pra evento que nunca tinha aparecido numa planilha antes.
 */
export async function updateEncargoComponentes(codigo: number, evento: string, tipo: TipoEvento, componentes: EncargoComponentes): Promise<Encargo> {
  await ensureSchema();
  const atual = await getEncargo(codigo);
  return upsertEncargo({
    codigo,
    evento: atual?.evento ?? evento,
    tipo: atual?.tipo ?? tipo,
    inss655: componentes.inss ? INSS_655_PADRAO : 0,
    inss515: componentes.inss ? INSS_515_PADRAO : 0,
    fgts: componentes.fgts ? FGTS_PADRAO : 0,
    provFerias: componentes.provisoes ? PROV_FERIAS_PADRAO : 0,
    prov13: componentes.provisoes ? PROV_13_PADRAO : 0,
    abateSaldo: atual?.abateSaldo ?? null,
  });
}

export async function deleteEncargo(codigo: number): Promise<void> {
  await ensureSchema();
  await getDb()`DELETE FROM encargos WHERE codigo = ${codigo}`;
}

export async function countEncargos(): Promise<number> {
  await ensureSchema();
  const [{ n }] = await getDb()<{ n: number }[]>`SELECT COUNT(*)::int as n FROM encargos`;
  return n;
}
