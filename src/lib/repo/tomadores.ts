import { ensureSchema, getDb } from "../db";
import type { Tomador } from "../types";

interface Row {
  codigo: number;
  nome: string;
  fpas: number;
  taxa_adm: number;
  pendente: boolean;
}

function toTomador(row: Row): Tomador {
  return { codigo: row.codigo, nome: row.nome, fpas: row.fpas === 515 ? 515 : 655, taxaAdm: row.taxa_adm, pendente: row.pendente };
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

/** Salva dados reais de um Tomador — sempre zera `pendente`, mesmo se o registro tivesse sido criado automaticamente (ver upsertTomadoresPendentes) por vir de um Cód Serviço sem cadastro. */
export async function upsertTomador(input: TomadorInput): Promise<Tomador> {
  await ensureSchema();
  await getDb()`
    INSERT INTO tomadores (codigo, nome, fpas, taxa_adm, pendente) VALUES (${input.codigo}, ${input.nome}, ${input.fpas}, ${input.taxaAdm}, false)
    ON CONFLICT (codigo) DO UPDATE SET nome = excluded.nome, fpas = excluded.fpas, taxa_adm = excluded.taxa_adm, pendente = false
  `;
  return (await getTomador(input.codigo))!;
}

export async function deleteTomador(codigo: number): Promise<void> {
  await ensureSchema();
  await getDb()`DELETE FROM tomadores WHERE codigo = ${codigo}`;
}

export interface TomadorPendenteInput {
  codigo: number;
  /** Vem de colaborador.descricaoServico (planilha de referência) quando disponível — senão usa um rótulo genérico com o código. */
  nomeSugerido: string | null;
}

/**
 * Cria um cadastro mínimo (pendente = true) para cada Cód Serviço de `entradas` que ainda não
 * existe em Tomadores — mesmo padrão de upsertColaboradoresPendentes (colaboradores.ts): em vez
 * de só descartar o faturamento desse colaborador com aviso, o tomador passa a existir e fica
 * fácil de achar pra completar FPAS/Taxa Adm. Nunca sobrescreve um tomador já cadastrado (mesmo
 * que pendente), então não derruba dados reais já preenchidos.
 */
export async function upsertTomadoresPendentes(entradas: TomadorPendenteInput[]): Promise<Tomador[]> {
  await ensureSchema();
  const codigos = [...new Set(entradas.map((e) => e.codigo))];
  if (codigos.length === 0) return [];

  const sql = getDb();
  const existentes = await sql<{ codigo: number }[]>`SELECT codigo FROM tomadores WHERE codigo IN ${sql(codigos)}`;
  const jaExiste = new Set(existentes.map((r) => r.codigo));

  const criados: Tomador[] = [];
  const jaCriados = new Set<number>();
  for (const e of entradas) {
    if (jaExiste.has(e.codigo) || jaCriados.has(e.codigo)) continue;
    jaCriados.add(e.codigo);
    const nome = e.nomeSugerido?.trim() || `Tomador cód. ${e.codigo} (cadastro pendente)`;
    await sql`
      INSERT INTO tomadores (codigo, nome, fpas, taxa_adm, pendente) VALUES (${e.codigo}, ${nome}, 655, 0, true)
      ON CONFLICT (codigo) DO NOTHING
    `;
    const tomador = await getTomador(e.codigo);
    if (tomador) criados.push(tomador);
  }
  return criados;
}

export async function countTomadores(): Promise<number> {
  await ensureSchema();
  const [{ n }] = await getDb()<{ n: number }[]>`SELECT COUNT(*)::int as n FROM tomadores`;
  return n;
}
