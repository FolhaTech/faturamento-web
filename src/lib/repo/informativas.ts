import { randomUUID } from "node:crypto";
import { ensureSchema, getDb } from "../db";
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

export async function listInformativas(): Promise<Informativa[]> {
  await ensureSchema();
  const rows = await getDb()<Row[]>`SELECT * FROM informativas ORDER BY evento`;
  return rows.map(toInformativa);
}

export async function getInformativa(id: string): Promise<Informativa | null> {
  await ensureSchema();
  const rows = await getDb()<Row[]>`SELECT * FROM informativas WHERE id = ${id}`;
  return rows[0] ? toInformativa(rows[0]) : null;
}

export interface InformativaInput {
  codigo: number | null;
  evento: string;
  valor: number;
  recorrencia: string | null;
  inicio: string | null;
  obs: string | null;
}

export async function createInformativa(input: InformativaInput): Promise<Informativa> {
  await ensureSchema();
  const id = randomUUID();
  await getDb()`
    INSERT INTO informativas (id, codigo, evento, valor, recorrencia, inicio, obs)
    VALUES (${id}, ${input.codigo}, ${input.evento}, ${input.valor}, ${input.recorrencia}, ${input.inicio}, ${input.obs})
  `;
  return (await getInformativa(id))!;
}

export async function updateInformativa(id: string, input: InformativaInput): Promise<Informativa> {
  await ensureSchema();
  await getDb()`
    UPDATE informativas
    SET codigo = ${input.codigo}, evento = ${input.evento}, valor = ${input.valor},
        recorrencia = ${input.recorrencia}, inicio = ${input.inicio}, obs = ${input.obs}
    WHERE id = ${id}
  `;
  const updated = await getInformativa(id);
  if (!updated) throw new Error("Informativa não encontrada.");
  return updated;
}

export async function deleteInformativa(id: string): Promise<void> {
  await ensureSchema();
  await getDb()`DELETE FROM informativas WHERE id = ${id}`;
}

export async function countInformativas(): Promise<number> {
  await ensureSchema();
  const [{ n }] = await getDb()<{ n: number }[]>`SELECT COUNT(*)::int as n FROM informativas`;
  return n;
}

function normaliza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase();
}

/** Casamento por nome do evento (ignorando acento/caixa) — usado na importação para não duplicar a cada re-envio do arquivo-base. */
export async function findInformativaByEvento(evento: string): Promise<Informativa | null> {
  const alvo = normaliza(evento);
  const rows = await listInformativas();
  return rows.find((r) => normaliza(r.evento) === alvo) ?? null;
}
