import { getDb } from "../db";
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

export function listEncargos(): Encargo[] {
  const rows = getDb().prepare("SELECT * FROM encargos ORDER BY evento").all() as unknown as Row[];
  return rows.map(toEncargo);
}

export function getEncargo(codigo: number): Encargo | null {
  const row = getDb().prepare("SELECT * FROM encargos WHERE codigo = ?").get(codigo) as unknown as Row | undefined;
  return row ? toEncargo(row) : null;
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

export function upsertEncargo(input: EncargoInput): Encargo {
  getDb()
    .prepare(
      `INSERT INTO encargos (codigo, evento, tipo, inss_655, inss_515, fgts, prov_ferias, prov_13)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(codigo) DO UPDATE SET
         evento = excluded.evento, tipo = excluded.tipo, inss_655 = excluded.inss_655,
         inss_515 = excluded.inss_515, fgts = excluded.fgts, prov_ferias = excluded.prov_ferias, prov_13 = excluded.prov_13`,
    )
    .run(input.codigo, input.evento, input.tipo, input.inss655, input.inss515, input.fgts, input.provFerias, input.prov13);
  return getEncargo(input.codigo)!;
}

export function deleteEncargo(codigo: number): void {
  getDb().prepare("DELETE FROM encargos WHERE codigo = ?").run(codigo);
}

export function countEncargos(): number {
  const row = getDb().prepare("SELECT COUNT(*) as n FROM encargos").get() as unknown as { n: number };
  return row.n;
}
