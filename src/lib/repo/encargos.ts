import { ensureSchema, getDb } from "../db";
import type { Encargo, TipoEvento } from "../types";

interface Row {
  codigo: number;
  evento: string;
  tipo: string;
  inss_655: number;
  inss_515: number;
  fgts: number;
  prov_ferias: number;
  prov_13: number;
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
}

export async function upsertEncargo(input: EncargoInput): Promise<Encargo> {
  await ensureSchema();
  await getDb()`
    INSERT INTO encargos (codigo, evento, tipo, inss_655, inss_515, fgts, prov_ferias, prov_13)
    VALUES (${input.codigo}, ${input.evento}, ${input.tipo}, ${input.inss655}, ${input.inss515}, ${input.fgts}, ${input.provFerias}, ${input.prov13})
    ON CONFLICT (codigo) DO UPDATE SET
      evento = excluded.evento, tipo = excluded.tipo, inss_655 = excluded.inss_655,
      inss_515 = excluded.inss_515, fgts = excluded.fgts, prov_ferias = excluded.prov_ferias, prov_13 = excluded.prov_13
  `;
  return (await getEncargo(input.codigo))!;
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
