import { getDb } from "../db";
import type { Tomador } from "../types";

interface Row {
  codigo: number;
  nome: string;
  fpas: number;
  taxa_adm: number;
}

function toTomador(row: Row): Tomador {
  return { codigo: row.codigo, nome: row.nome, fpas: row.fpas === 515 ? 515 : 655, taxaAdm: row.taxa_adm };
}

export function listTomadores(): Tomador[] {
  const rows = getDb().prepare("SELECT * FROM tomadores ORDER BY nome").all() as unknown as Row[];
  return rows.map(toTomador);
}

export function getTomador(codigo: number): Tomador | null {
  const row = getDb().prepare("SELECT * FROM tomadores WHERE codigo = ?").get(codigo) as unknown as Row | undefined;
  return row ? toTomador(row) : null;
}

export interface TomadorInput {
  codigo: number;
  nome: string;
  fpas: 515 | 655;
  taxaAdm: number;
}

export function upsertTomador(input: TomadorInput): Tomador {
  getDb()
    .prepare(
      `INSERT INTO tomadores (codigo, nome, fpas, taxa_adm) VALUES (?, ?, ?, ?)
       ON CONFLICT(codigo) DO UPDATE SET nome = excluded.nome, fpas = excluded.fpas, taxa_adm = excluded.taxa_adm`,
    )
    .run(input.codigo, input.nome, input.fpas, input.taxaAdm);
  return getTomador(input.codigo)!;
}

export function deleteTomador(codigo: number): void {
  getDb().prepare("DELETE FROM tomadores WHERE codigo = ?").run(codigo);
}

export function countTomadores(): number {
  const row = getDb().prepare("SELECT COUNT(*) as n FROM tomadores").get() as unknown as { n: number };
  return row.n;
}
