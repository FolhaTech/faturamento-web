import { ensureSchema, getDb } from "../db";
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

export async function listTomadores(): Promise<Tomador[]> {
  await ensureSchema();
  const rows = await getDb()<Row[]>`SELECT * FROM tomadores ORDER BY nome`;
  return rows.map(toTomador);
}

export async function getTomador(codigo: number): Promise<Tomador | null> {
  await ensureSchema();
  const rows = await getDb()<Row[]>`SELECT * FROM tomadores WHERE codigo = ${codigo}`;
  return rows[0] ? toTomador(rows[0]) : null;
}

export interface TomadorInput {
  codigo: number;
  nome: string;
  fpas: 515 | 655;
  taxaAdm: number;
}

export async function upsertTomador(input: TomadorInput): Promise<Tomador> {
  await ensureSchema();
  await getDb()`
    INSERT INTO tomadores (codigo, nome, fpas, taxa_adm) VALUES (${input.codigo}, ${input.nome}, ${input.fpas}, ${input.taxaAdm})
    ON CONFLICT (codigo) DO UPDATE SET nome = excluded.nome, fpas = excluded.fpas, taxa_adm = excluded.taxa_adm
  `;
  return (await getTomador(input.codigo))!;
}

export async function deleteTomador(codigo: number): Promise<void> {
  await ensureSchema();
  await getDb()`DELETE FROM tomadores WHERE codigo = ${codigo}`;
}

export async function countTomadores(): Promise<number> {
  await ensureSchema();
  const [{ n }] = await getDb()<{ n: number }[]>`SELECT COUNT(*)::int as n FROM tomadores`;
  return n;
}
