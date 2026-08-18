import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import type { Movimento } from "../types";

interface Row {
  id: string;
  codigo: number;
  matricula: number;
  nome: string;
  evento: string;
  competencia: string;
  valor: number;
  ref: number;
  tipo: string;
  forma: string | null;
}

function toMovimento(row: Row): Movimento {
  return {
    id: row.id,
    codigo: row.codigo,
    matricula: row.matricula,
    nome: row.nome,
    evento: row.evento,
    competencia: row.competencia,
    valor: row.valor,
    ref: row.ref,
    tipo: row.tipo as Movimento["tipo"],
    forma: row.forma,
  };
}

export function listMovimentosByCompetencia(competencia: string): Movimento[] {
  const rows = getDb().prepare("SELECT * FROM movimentos WHERE competencia = ?").all(competencia) as unknown as Row[];
  return rows.map(toMovimento);
}

export function listCompetencias(): string[] {
  const rows = getDb().prepare("SELECT DISTINCT competencia FROM movimentos ORDER BY competencia DESC").all() as unknown as {
    competencia: string;
  }[];
  return rows.map((r) => r.competencia);
}

export function countMovimentos(): number {
  const row = getDb().prepare("SELECT COUNT(*) as n FROM movimentos").get() as unknown as { n: number };
  return row.n;
}

export interface MovimentoInput {
  codigo: number;
  matricula: number;
  nome: string;
  evento: string;
  competencia: string;
  valor: number;
  ref: number;
  tipo: Movimento["tipo"];
  forma: string | null;
}

/**
 * Substitui todos os lançamentos das competências presentes em `linhas` —
 * reenviar o arquivo do mês atualiza em vez de duplicar os lançamentos.
 */
export function replaceMovimentosPorCompetencia(linhas: MovimentoInput[]): number {
  const db = getDb();
  const competencias = [...new Set(linhas.map((l) => l.competencia))];

  const del = db.prepare("DELETE FROM movimentos WHERE competencia = ?");
  const insert = db.prepare(
    `INSERT INTO movimentos (id, codigo, matricula, nome, evento, competencia, valor, ref, tipo, forma)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  db.exec("BEGIN");
  try {
    for (const comp of competencias) del.run(comp);
    for (const l of linhas) {
      insert.run(randomUUID(), l.codigo, l.matricula, l.nome, l.evento, l.competencia, l.valor, l.ref, l.tipo, l.forma);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return linhas.length;
}

export function deleteCompetencia(competencia: string): void {
  getDb().prepare("DELETE FROM movimentos WHERE competencia = ?").run(competencia);
}
