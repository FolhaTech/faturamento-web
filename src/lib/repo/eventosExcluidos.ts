import { ensureSchema, getDb } from "../db";

export interface EventoExcluido {
  matricula: number;
  competencia: string;
  evento: string;
  excluidoEm: string;
}

interface Row {
  matricula: number;
  competencia: string;
  evento: string;
  excluido_em: string;
}

function toEventoExcluido(row: Row): EventoExcluido {
  return { matricula: row.matricula, competencia: row.competencia, evento: row.evento, excluidoEm: row.excluido_em };
}

/** Chave usada pra cruzar um evento (matrícula + nome do evento) contra o Set retornado por listEventosExcluidosKeys — mesma chave usada em filtrarEventosExcluidos (calc/eventosExcluidos.ts). */
export function chaveEventoExcluido(matricula: number, evento: string): string {
  return `${matricula}\u0000${evento}`;
}

/** Todos os eventos excluídos manualmente dessa competência, de qualquer colaborador — quem chama filtra pela matrícula que estiver mostrando (ver EventosExcluidosPanel em FaturamentoViewer.tsx). */
export async function listEventosExcluidos(competencia: string): Promise<EventoExcluido[]> {
  await ensureSchema();
  const rows = await getDb()<Row[]>`SELECT * FROM eventos_excluidos WHERE competencia = ${competencia} ORDER BY excluido_em DESC`;
  return rows.map(toEventoExcluido);
}

/** Mesmo conteúdo de listEventosExcluidos, já como Set de chaves (ver chaveEventoExcluido) — pra filtrar CalculatedLine[] rápido no cálculo ao vivo (ver calcularLinesAoVivo em faturaCompetencia.ts). */
export async function listEventosExcluidosKeys(competencia: string): Promise<Set<string>> {
  const eventos = await listEventosExcluidos(competencia);
  return new Set(eventos.map((e) => chaveEventoExcluido(e.matricula, e.evento)));
}

/** Exclui um evento da fatura de UM colaborador nessa competência — não afeta os demais colaboradores. Fica fora do cálculo até alguém chamar restaurarEvento, mesmo que o arquivo de Movimentos seja reenviado depois. */
export async function excluirEvento(matricula: number, competencia: string, evento: string): Promise<void> {
  await ensureSchema();
  await getDb()`
    INSERT INTO eventos_excluidos (matricula, competencia, evento, excluido_em)
    VALUES (${matricula}, ${competencia}, ${evento}, now())
    ON CONFLICT (matricula, competencia, evento) DO NOTHING
  `;
}

/** Desfaz a exclusão — o evento volta a contar no cálculo ao vivo desse colaborador nessa competência (não afeta uma fatura já salva até ela ser salva de novo, igual qualquer outro ajuste solto). */
export async function restaurarEvento(matricula: number, competencia: string, evento: string): Promise<void> {
  await ensureSchema();
  await getDb()`DELETE FROM eventos_excluidos WHERE matricula = ${matricula} AND competencia = ${competencia} AND evento = ${evento}`;
}
