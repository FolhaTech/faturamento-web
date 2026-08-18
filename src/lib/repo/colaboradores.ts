import { getDb } from "../db";
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
  page?: number;
  pageSize?: number;
}

export interface ListColaboradoresResult {
  items: Colaborador[];
  total: number;
  page: number;
  pageSize: number;
}

export function listColaboradores(opts: ListColaboradoresOptions = {}): ListColaboradoresResult {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 25));

  const where: string[] = [];
  const params: (string | number)[] = [];

  if (opts.busca) {
    where.push("(nome LIKE ? OR CAST(matricula AS TEXT) LIKE ?)");
    params.push(`%${opts.busca}%`, `%${opts.busca}%`);
  }
  if (opts.situacao) {
    where.push("situacao = ?");
    params.push(opts.situacao);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const total = (
    getDb()
      .prepare(`SELECT COUNT(*) as n FROM colaboradores ${whereSql}`)
      .get(...params) as unknown as { n: number }
  ).n;

  const rows = getDb()
    .prepare(`SELECT * FROM colaboradores ${whereSql} ORDER BY nome LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize) as unknown as Row[];

  return { items: rows.map(toColaborador), total, page, pageSize };
}

export function getColaborador(matricula: number): Colaborador | null {
  const row = getDb().prepare("SELECT * FROM colaboradores WHERE matricula = ?").get(matricula) as unknown as
    | Row
    | undefined;
  return row ? toColaborador(row) : null;
}

/** Busca em lote por matrícula — usado pelo motor de cálculo para não fazer N consultas por lançamento. */
export function getColaboradoresPorMatriculas(matriculas: number[]): Map<number, Colaborador> {
  const map = new Map<number, Colaborador>();
  const unicos = [...new Set(matriculas)];
  if (unicos.length === 0) return map;

  const placeholders = unicos.map(() => "?").join(",");
  const rows = getDb()
    .prepare(`SELECT * FROM colaboradores WHERE matricula IN (${placeholders})`)
    .all(...unicos) as unknown as Row[];
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

export function upsertColaborador(input: ColaboradorInput): Colaborador {
  const dados = input.dados;
  const nome = asStr(dados.nome) ?? "";
  const situacao = asStr(dados.situacao);
  const codServicoRaw = dados.cod_servico;
  const codServico = codServicoRaw !== null && codServicoRaw !== undefined && codServicoRaw !== "" ? asNum(codServicoRaw) : null;
  const descricaoServico = asStr(dados.descricao_servico);
  const salario = asNum(dados.salario);
  const admissao = asStr(dados.admissao);
  const dataDemissao = asStr(dados.data_demissao);

  getDb()
    .prepare(
      `INSERT INTO colaboradores (matricula, nome, situacao, cod_servico, descricao_servico, salario, admissao, data_demissao, dados)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(matricula) DO UPDATE SET
         nome = excluded.nome, situacao = excluded.situacao, cod_servico = excluded.cod_servico,
         descricao_servico = excluded.descricao_servico, salario = excluded.salario,
         admissao = excluded.admissao, data_demissao = excluded.data_demissao, dados = excluded.dados`,
    )
    .run(input.matricula, nome, situacao, codServico, descricaoServico, salario, admissao, dataDemissao, JSON.stringify(dados));

  return getColaborador(input.matricula)!;
}

export function deleteColaborador(matricula: number): void {
  getDb().prepare("DELETE FROM colaboradores WHERE matricula = ?").run(matricula);
}

export function countColaboradores(): number {
  const row = getDb().prepare("SELECT COUNT(*) as n FROM colaboradores").get() as unknown as { n: number };
  return row.n;
}

export function listSituacoes(): string[] {
  const rows = getDb()
    .prepare("SELECT DISTINCT situacao FROM colaboradores WHERE situacao IS NOT NULL ORDER BY situacao")
    .all() as unknown as { situacao: string }[];
  return rows.map((r) => r.situacao);
}
