import { randomUUID } from "node:crypto";
import type { PreviaTotalPorCcusto } from "../calc/faturaCompetencia";
import type { CalculatedLine } from "../calc/engine";
import { ensureSchema, getDb } from "../db";

export interface FaturaSalva {
  id: string;
  competencia: string;
  usuarioEmail: string;
  usuarioNome: string;
  lines: CalculatedLine[];
  warnings: string[];
  salvoEm: string;
  /** true = essa entrada não vale mais como a versão ativa de quem salvou (descartada manualmente, ou por um reenvio de Movimentos) — continua na timeline, só não é usada em nenhum cálculo/PDF. */
  descartada: boolean;
  /** Total já cobrado na Prévia correspondente, por Ccusto, congelado no momento de salvar — ver calcularPreviaTotalFaturaPorCcusto em faturaCompetencia.ts. Array vazio quando não havia Prévia (ou é a própria Prévia, ou a foto é antiga). */
  previaTotalFaturaPorCcusto: PreviaTotalPorCcusto[];
}

interface Row {
  id: string;
  competencia: string;
  usuario_email: string;
  usuario_nome: string;
  lines: string;
  warnings: string;
  salvo_em: string;
  descartada: boolean;
  previa_total_fatura: string;
}

function toFaturaSalva(row: Row): FaturaSalva {
  return {
    id: row.id,
    competencia: row.competencia,
    usuarioEmail: row.usuario_email,
    usuarioNome: row.usuario_nome,
    lines: JSON.parse(row.lines) as CalculatedLine[],
    warnings: JSON.parse(row.warnings) as string[],
    salvoEm: row.salvo_em,
    descartada: row.descartada,
    previaTotalFaturaPorCcusto: JSON.parse(row.previa_total_fatura) as PreviaTotalPorCcusto[],
  };
}

/**
 * Foto congelada ATIVA dessa competência, mas só a do usuário dado — cada usuário vê a própria
 * versão salva, nunca a de outro (dois usuários salvando a mesma competência não se sobrescrevem
 * mais, ver salvarFatura). É sempre a entrada mais recente desse usuário: se a mais recente foi
 * descartada, retorna null (cálculo ao vivo) mesmo que exista uma mais antiga ainda não
 * descartada — descartar quer dizer "quero o cálculo ao vivo agora", não "volta pro save anterior".
 */
export async function getFaturaSalvaDoUsuario(competencia: string, usuarioEmail: string): Promise<FaturaSalva | null> {
  await ensureSchema();
  const rows = await getDb()<Row[]>`
    SELECT * FROM faturas_salvas
    WHERE competencia = ${competencia} AND usuario_email = ${usuarioEmail}
    ORDER BY salvo_em DESC
    LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.descartada) return null;
  return toFaturaSalva(row);
}

/** Salva uma NOVA foto da competência, atribuída a quem salvou — nunca sobrescreve uma foto já existente (nem a de outro usuário, nem uma anterior deste mesmo usuário): fica tudo na timeline (ver listTimelineFaturas). */
export async function salvarFatura(
  competencia: string,
  usuario: { email: string; nome: string },
  lines: CalculatedLine[],
  warnings: string[],
  previaTotalFaturaPorCcusto: PreviaTotalPorCcusto[],
): Promise<FaturaSalva> {
  await ensureSchema();
  const id = randomUUID();
  const rows = await getDb()<Row[]>`
    INSERT INTO faturas_salvas (id, competencia, usuario_email, usuario_nome, lines, warnings, salvo_em, descartada, previa_total_fatura)
    VALUES (${id}, ${competencia}, ${usuario.email}, ${usuario.nome}, ${JSON.stringify(lines)}, ${JSON.stringify(warnings)}, now(), false, ${JSON.stringify(previaTotalFaturaPorCcusto)})
    RETURNING *
  `;
  return toFaturaSalva(rows[0]);
}

/** Descarta a versão ativa do usuário dado — ele volta a ver o cálculo ao vivo dessa competência. Não apaga nada: a entrada continua na timeline, só marcada como descartada. Não afeta a versão de outros usuários. */
export async function descartarFaturaSalva(competencia: string, usuarioEmail: string): Promise<void> {
  await ensureSchema();
  await getDb()`
    UPDATE faturas_salvas SET descartada = true
    WHERE id = (
      SELECT id FROM faturas_salvas
      WHERE competencia = ${competencia} AND usuario_email = ${usuarioEmail}
      ORDER BY salvo_em DESC
      LIMIT 1
    )
  `;
}

/** Toda a timeline de faturas salvas dessa competência — de todos os usuários, mais recente primeiro, inclusive as já descartadas (pra manter o histórico visível de quem salvou o quê). */
export async function listTimelineFaturas(competencia: string): Promise<FaturaSalva[]> {
  await ensureSchema();
  const rows = await getDb()<Row[]>`SELECT * FROM faturas_salvas WHERE competencia = ${competencia} ORDER BY salvo_em DESC`;
  return rows.map(toFaturaSalva);
}

/** Quais das competências dadas têm fatura ativa salva PELO PRÓPRIO usuário — usado pro selo "salva" no seletor de competência (cada usuário só vê o selo da própria versão, ver getFaturaSalvaDoUsuario). */
export async function listMinhasCompetenciasComFaturaSalva(competencias: string[], usuarioEmail: string): Promise<Set<string>> {
  if (competencias.length === 0 || !usuarioEmail) return new Set();
  await ensureSchema();
  const rows = await getDb()<{ competencia: string; descartada: boolean }[]>`
    SELECT DISTINCT ON (competencia) competencia, descartada
    FROM faturas_salvas
    WHERE competencia = ANY(${competencias}) AND usuario_email = ${usuarioEmail}
    ORDER BY competencia, salvo_em DESC
  `;
  return new Set(rows.filter((r) => !r.descartada).map((r) => r.competencia));
}

/** Quais das competências dadas têm fatura ativa de QUALQUER usuário — usado pra avisar antes de um reenvio de Movimentos descartar essas fotos (ver replaceMovimentosPorCompetencia), já que o reenvio afeta todo mundo que tiver uma versão ativa, não só quem está reenviando. */
export async function listCompetenciasComFaturaSalva(competencias: string[]): Promise<Set<string>> {
  if (competencias.length === 0) return new Set();
  await ensureSchema();
  const rows = await getDb()<{ competencia: string; descartada: boolean }[]>`
    SELECT DISTINCT ON (competencia, usuario_email) competencia, usuario_email, descartada
    FROM faturas_salvas
    WHERE competencia = ANY(${competencias})
    ORDER BY competencia, usuario_email, salvo_em DESC
  `;
  return new Set(rows.filter((r) => !r.descartada).map((r) => r.competencia));
}
