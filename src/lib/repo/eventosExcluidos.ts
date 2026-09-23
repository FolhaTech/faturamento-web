import { ensureSchema, getDb } from "../db";

export interface EventoExcluido {
  ccustoCodigo: string;
  competencia: string;
  evento: string;
  excluidoEm: string;
}

interface Row {
  ccusto_codigo: string;
  competencia: string;
  evento: string;
  excluido_em: string;
}

function toEventoExcluido(row: Row): EventoExcluido {
  return { ccustoCodigo: row.ccusto_codigo, competencia: row.competencia, evento: row.evento, excluidoEm: row.excluido_em };
}

/** Chave usada pra cruzar um evento (Ccusto + nome do evento) contra o Set retornado por listEventosExcluidosKeys — mesma chave usada em filtrarEventosExcluidos (calc/eventosExcluidos.ts). */
export function chaveEventoExcluido(ccustoCodigo: string, evento: string): string {
  return `${ccustoCodigo}\u0000${evento}`;
}

/** Todos os eventos excluídos manualmente dessa competência, em qualquer Centro de Custo — quem chama filtra pelo Ccusto que estiver mostrando (ver EventosExcluidosPanel em FaturamentoViewer.tsx). */
export async function listEventosExcluidos(competencia: string): Promise<EventoExcluido[]> {
  await ensureSchema();
  const rows = await getDb()<Row[]>`SELECT * FROM eventos_excluidos WHERE competencia = ${competencia} ORDER BY excluido_em DESC`;
  return rows.map(toEventoExcluido);
}

/** Mesmo conteúdo de listEventosExcluidos, já como Set de chaves (ver chaveEventoExcluido) — pra filtrar CalculatedLine[] rápido no cálculo ao vivo (ver calcularLinesAoVivo em faturaCompetencia.ts). */
export async function listEventosExcluidosKeys(competencia: string): Promise<Set<string>> {
  const eventos = await listEventosExcluidos(competencia);
  return new Set(eventos.map((e) => chaveEventoExcluido(e.ccustoCodigo, e.evento)));
}

/** Exclui um evento da fatura do Centro de Custo INTEIRO (todos os colaboradores) nessa competência — fica fora do cálculo até alguém chamar restaurarEvento, mesmo que o arquivo de Movimentos seja reenviado depois. */
export async function excluirEvento(ccustoCodigo: string, competencia: string, evento: string): Promise<void> {
  await ensureSchema();
  await getDb()`
    INSERT INTO eventos_excluidos (ccusto_codigo, competencia, evento, excluido_em)
    VALUES (${ccustoCodigo}, ${competencia}, ${evento}, now())
    ON CONFLICT (ccusto_codigo, competencia, evento) DO NOTHING
  `;
}

/** Desfaz a exclusão — o evento volta a contar no cálculo ao vivo dessa competência (não afeta uma fatura já salva até ela ser salva de novo, igual qualquer outro ajuste solto). */
export async function restaurarEvento(ccustoCodigo: string, competencia: string, evento: string): Promise<void> {
  await ensureSchema();
  await getDb()`DELETE FROM eventos_excluidos WHERE ccusto_codigo = ${ccustoCodigo} AND competencia = ${competencia} AND evento = ${evento}`;
}
