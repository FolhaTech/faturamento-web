import { randomUUID } from "node:crypto";
import { getDb } from "../db";
import type { Informativa } from "../types";

interface Row {
  id: string;
  codigo: number | null;
  evento: string;
  valor: number;
  recorrencia: string | null;
  inicio: string | null;
  obs: string | null;
}

function toInformativa(row: Row): Informativa {
  return { ...row };
}

export function listInformativas(): Informativa[] {
  const rows = getDb().prepare("SELECT * FROM informativas ORDER BY evento").all() as unknown as Row[];
  return rows.map(toInformativa);
}

export function getInformativa(id: string): Informativa | null {
  const row = getDb().prepare("SELECT * FROM informativas WHERE id = ?").get(id) as unknown as Row | undefined;
  return row ? toInformativa(row) : null;
}

function normaliza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
}

/** Casamento por nome do evento (ignorando acento/caixa) — usado na importação para não duplicar a cada re-envio do arquivo-base. */
export function findInformativaByEvento(evento: string): Informativa | null {
  const alvo = normaliza(evento);
  const rows = getDb().prepare("SELECT * FROM informativas").all() as unknown as Row[];
  const found = rows.find((r) => normaliza(r.evento) === alvo);
  return found ? toInformativa(found) : null;
}

export interface InformativaInput {
  codigo: number | null;
  evento: string;
  valor: number;
  recorrencia: string | null;
  inicio: string | null;
  obs: string | null;
}

export function createInformativa(input: InformativaInput): Informativa {
  const id = randomUUID();
  getDb()
    .prepare(`INSERT INTO informativas (id, codigo, evento, valor, recorrencia, inicio, obs) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(id, input.codigo, input.evento, input.valor, input.recorrencia, input.inicio, input.obs);
  return getInformativa(id)!;
}

export function updateInformativa(id: string, input: InformativaInput): Informativa {
  getDb()
    .prepare(
      `UPDATE informativas SET codigo = ?, evento = ?, valor = ?, recorrencia = ?, inicio = ?, obs = ? WHERE id = ?`,
    )
    .run(input.codigo, input.evento, input.valor, input.recorrencia, input.inicio, input.obs, id);
  const updated = getInformativa(id);
  if (!updated) throw new Error("Informativa não encontrada.");
  return updated;
}

export function deleteInformativa(id: string): void {
  getDb().prepare("DELETE FROM informativas WHERE id = ?").run(id);
}

export function countInformativas(): number {
  const row = getDb().prepare("SELECT COUNT(*) as n FROM informativas").get() as unknown as { n: number };
  return row.n;
}
