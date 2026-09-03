import { ensureSchema, getDb } from "../db";
import { normalizaTexto } from "../text";
import type { Tomador } from "../types";

/**
 * Padrão de Gross Up (ver calcularNf em calc/engine.ts) — duplicados aqui como literais pra não
 * criar import circular (engine.ts já importa deste módulo). CODIGO_TOMADOR_NF_SOBRE_TAXA_ADM é
 * o único Tomador (ITAU código 14) que usa a fórmula/default diferente.
 */
const GROSS_UP_PADRAO = 0.8675;
const GROSS_UP_PADRAO_TOMADOR_ESPECIAL = 0.1325;
const CODIGO_TOMADOR_NF_SOBRE_TAXA_ADM = 14;

interface Row {
  codigo: number;
  nome: string;
  fpas: number;
  taxa_adm: number;
  gross_up: number;
  pendente: boolean;
}

function toTomador(row: Row): Tomador {
  return { codigo: row.codigo, nome: row.nome, fpas: row.fpas === 515 ? 515 : 655, taxaAdm: row.taxa_adm, grossUp: row.gross_up, pendente: row.pendente };
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
  /** Ausente = mantém o padrão (0,8675 — 0,1325 só pro Tomador 14/ITAU) — a maioria dos chamadores não precisa pensar nisso. */
  grossUp?: number;
}

/** Salva dados reais de um Tomador — sempre zera `pendente`, mesmo se o registro tivesse sido criado automaticamente (ver upsertTomadoresPendentes) por vir de um Cód Serviço sem cadastro. */
export async function upsertTomador(input: TomadorInput): Promise<Tomador> {
  await ensureSchema();
  const grossUp = input.grossUp ?? (input.codigo === CODIGO_TOMADOR_NF_SOBRE_TAXA_ADM ? GROSS_UP_PADRAO_TOMADOR_ESPECIAL : GROSS_UP_PADRAO);
  await getDb()`
    INSERT INTO tomadores (codigo, nome, fpas, taxa_adm, gross_up, pendente)
    VALUES (${input.codigo}, ${input.nome}, ${input.fpas}, ${input.taxaAdm}, ${grossUp}, false)
    ON CONFLICT (codigo) DO UPDATE SET nome = excluded.nome, fpas = excluded.fpas, taxa_adm = excluded.taxa_adm, gross_up = excluded.gross_up, pendente = false
  `;
  return (await getTomador(input.codigo))!;
}

/** Atualiza só o Gross Up de um Tomador já cadastrado — usado pelo formulário rápido na tela de Faturamento, que não tem os demais campos (nome/FPAS/Taxa Adm) à mão. */
export async function updateGrossUp(codigo: number, grossUp: number): Promise<Tomador> {
  await ensureSchema();
  await getDb()`UPDATE tomadores SET gross_up = ${grossUp} WHERE codigo = ${codigo}`;
  const tomador = await getTomador(codigo);
  if (!tomador) throw new Error(`Tomador ${codigo} não encontrado.`);
  return tomador;
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
    const grossUp = e.codigo === CODIGO_TOMADOR_NF_SOBRE_TAXA_ADM ? GROSS_UP_PADRAO_TOMADOR_ESPECIAL : GROSS_UP_PADRAO;
    await sql`
      INSERT INTO tomadores (codigo, nome, fpas, taxa_adm, gross_up, pendente) VALUES (${e.codigo}, ${nome}, 655, 0, ${grossUp}, true)
      ON CONFLICT (codigo) DO NOTHING
    `;
    const tomador = await getTomador(e.codigo);
    if (tomador) criados.push(tomador);
  }
  return criados;
}

export interface BuscaTomadorPorNome {
  tomador: Tomador | null;
  /** true = mais de um Tomador cadastrado com esse nome (ex.: 2 contratos do mesmo cliente com FPAS diferentes) — não dá pra escolher automaticamente. */
  ambiguo: boolean;
}

/**
 * Busca um Tomador por nome exato (ignorando maiúsculas/acentos) — usado pra vincular
 * automaticamente colaboradores ao Tomador declarado no cabeçalho "Empresa:" de um arquivo de
 * Movimentos (layout "relatório", ver parseMovimentos.ts). Nunca escolhe entre nomes duplicados
 * (ver labelTomador em colaboradores/page.tsx sobre o mesmo cliente ter mais de um contrato) —
 * `ambiguo: true` sinaliza esse caso pro chamador decidir o que fazer (não vincular, avisar).
 */
export async function getTomadorPorNome(nome: string): Promise<BuscaTomadorPorNome> {
  const alvo = normalizaTexto(nome);
  const todos = await listTomadores();
  const encontrados = todos.filter((t) => normalizaTexto(t.nome) === alvo);
  if (encontrados.length === 1) return { tomador: encontrados[0], ambiguo: false };
  if (encontrados.length > 1) return { tomador: null, ambiguo: true };
  return { tomador: null, ambiguo: false };
}

export async function countTomadores(): Promise<number> {
  await ensureSchema();
  const [{ n }] = await getDb()<{ n: number }[]>`SELECT COUNT(*)::int as n FROM tomadores`;
  return n;
}
