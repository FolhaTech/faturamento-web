import { ensureSchema, getDb } from "../db";
import type { Colaborador, DadosColaborador } from "../types";

interface Row {
  matricula: number;
  nome: string;
  situacao: string | null;
  cod_servico: number | null;
  descricao_servico: string | null;
  salario: number;
  admissao: string | null;
  data_demissao: string | null;
  dados: string;
}

function toColaborador(row: Row): Colaborador {
  return {
    matricula: row.matricula,
    nome: row.nome,
    situacao: row.situacao,
    codServico: row.cod_servico,
    descricaoServico: row.descricao_servico,
    salario: row.salario,
    admissao: row.admissao,
    dataDemissao: row.data_demissao,
    dados: JSON.parse(row.dados) as DadosColaborador,
  };
}

export interface ListColaboradoresOptions {
  busca?: string;
  situacao?: string;
  /** Cód Emp — código da empresa do grupo (dentro de dados, não promovido a coluna). */
  codEmp?: string;
  /** Descrição cargo (dentro de dados). */
  descricaoCargo?: string;
  /**
   * Código do Tomador (coluna cod_servico) — não usar o texto de descricao_servico para filtrar:
   * o mesmo nome (ex. "ITAU UNIBANCO S.A") pode corresponder a mais de um Tomador (contratos/FPAS
   * diferentes), e só o código separa esses casos corretamente.
   */
  codServico?: number;
  /** Descrição Dpto (dentro de dados). */
  descricaoDpto?: string;
  /** Descrição Ccusto — centro de custo (dentro de dados). */
  descricaoCcusto?: string;
  page?: number;
  pageSize?: number;
}

export interface ListColaboradoresResult {
  items: Colaborador[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listColaboradores(opts: ListColaboradoresOptions = {}): Promise<ListColaboradoresResult> {
  await ensureSchema();
  const sql = getDb();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 25));
  const busca = opts.busca?.trim() || null;
  const situacao = opts.situacao?.trim() || null;
  const codEmp = opts.codEmp?.trim() || null;
  const descricaoCargo = opts.descricaoCargo?.trim() || null;
  const codServico = opts.codServico ?? null;
  const descricaoDpto = opts.descricaoDpto?.trim() || null;
  const descricaoCcusto = opts.descricaoCcusto?.trim() || null;

  const [{ n: total }] = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int as n FROM colaboradores
    WHERE (${busca}::text IS NULL OR nome ILIKE '%' || ${busca} || '%' OR CAST(matricula AS TEXT) LIKE '%' || ${busca} || '%')
      AND (${situacao}::text IS NULL OR situacao = ${situacao})
      AND (${codEmp}::text IS NULL OR dados::jsonb ->> 'cod_emp' = ${codEmp})
      AND (${descricaoCargo}::text IS NULL OR dados::jsonb ->> 'descricao_cargo' = ${descricaoCargo})
      AND (${codServico}::int IS NULL OR cod_servico = ${codServico})
      AND (${descricaoDpto}::text IS NULL OR dados::jsonb ->> 'descricao_dpto' = ${descricaoDpto})
      AND (${descricaoCcusto}::text IS NULL OR dados::jsonb ->> 'descricao_ccusto' = ${descricaoCcusto})
  `;

  const rows = await sql<Row[]>`
    SELECT * FROM colaboradores
    WHERE (${busca}::text IS NULL OR nome ILIKE '%' || ${busca} || '%' OR CAST(matricula AS TEXT) LIKE '%' || ${busca} || '%')
      AND (${situacao}::text IS NULL OR situacao = ${situacao})
      AND (${codEmp}::text IS NULL OR dados::jsonb ->> 'cod_emp' = ${codEmp})
      AND (${descricaoCargo}::text IS NULL OR dados::jsonb ->> 'descricao_cargo' = ${descricaoCargo})
      AND (${codServico}::int IS NULL OR cod_servico = ${codServico})
      AND (${descricaoDpto}::text IS NULL OR dados::jsonb ->> 'descricao_dpto' = ${descricaoDpto})
      AND (${descricaoCcusto}::text IS NULL OR dados::jsonb ->> 'descricao_ccusto' = ${descricaoCcusto})
    ORDER BY nome
    LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
  `;

  return { items: rows.map(toColaborador), total, page, pageSize };
}

export async function getColaborador(matricula: number): Promise<Colaborador | null> {
  await ensureSchema();
  const rows = await getDb()<Row[]>`SELECT * FROM colaboradores WHERE matricula = ${matricula}`;
  return rows[0] ? toColaborador(rows[0]) : null;
}

/** Busca em lote por matrícula — usado pelo motor de cálculo para não fazer N consultas por lançamento. */
export async function getColaboradoresPorMatriculas(matriculas: number[]): Promise<Map<number, Colaborador>> {
  const map = new Map<number, Colaborador>();
  const unicos = [...new Set(matriculas)];
  if (unicos.length === 0) return map;

  await ensureSchema();
  const sql = getDb();
  const rows = await sql<Row[]>`SELECT * FROM colaboradores WHERE matricula IN ${sql(unicos)}`;
  for (const row of rows) map.set(row.matricula, toColaborador(row));
  return map;
}

export interface ColaboradorInput {
  matricula: number;
  dados: DadosColaborador;
}

function asNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asStr(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  return String(v);
}

export async function upsertColaborador(input: ColaboradorInput): Promise<Colaborador> {
  await ensureSchema();
  const dados = input.dados;
  const nome = asStr(dados.nome) ?? "";
  const situacao = asStr(dados.situacao);
  const codServicoRaw = dados.cod_servico;
  const codServico = codServicoRaw !== null && codServicoRaw !== undefined && codServicoRaw !== "" ? asNum(codServicoRaw) : null;
  const descricaoServico = asStr(dados.descricao_servico);
  const salario = asNum(dados.salario);
  const admissao = asStr(dados.admissao);
  const dataDemissao = asStr(dados.data_demissao);

  await getDb()`
    INSERT INTO colaboradores (matricula, nome, situacao, cod_servico, descricao_servico, salario, admissao, data_demissao, dados)
    VALUES (${input.matricula}, ${nome}, ${situacao}, ${codServico}, ${descricaoServico}, ${salario}, ${admissao}, ${dataDemissao}, ${JSON.stringify(dados)})
    ON CONFLICT (matricula) DO UPDATE SET
      nome = excluded.nome, situacao = excluded.situacao, cod_servico = excluded.cod_servico,
      descricao_servico = excluded.descricao_servico, salario = excluded.salario,
      admissao = excluded.admissao, data_demissao = excluded.data_demissao, dados = excluded.dados
  `;

  return (await getColaborador(input.matricula))!;
}

export async function deleteColaborador(matricula: number): Promise<void> {
  await ensureSchema();
  await getDb()`DELETE FROM colaboradores WHERE matricula = ${matricula}`;
}

export async function countColaboradores(): Promise<number> {
  await ensureSchema();
  const [{ n }] = await getDb()<{ n: number }[]>`SELECT COUNT(*)::int as n FROM colaboradores`;
  return n;
}

export async function listSituacoes(): Promise<string[]> {
  await ensureSchema();
  const rows = await getDb()<{ situacao: string }[]>`
    SELECT DISTINCT situacao FROM colaboradores WHERE situacao IS NOT NULL ORDER BY situacao
  `;
  return rows.map((r) => r.situacao);
}

/** Valores distintos e não vazios de um campo de `dados` (JSON) — usado para popular os dropdowns de filtro. */
export async function listValoresDistintosDados(campo: string): Promise<string[]> {
  await ensureSchema();
  const rows = await getDb()<{ v: string }[]>`
    SELECT DISTINCT dados::jsonb ->> ${campo} as v FROM colaboradores
    WHERE dados::jsonb ->> ${campo} IS NOT NULL AND dados::jsonb ->> ${campo} != ''
    ORDER BY v
  `;
  return rows.map((r) => r.v);
}

