import { camposVazios, type Campo, type CamposCompartilhados, LIMITES } from "../camposCompartilhados";
import { ensureSchema, getDb } from "../db";

/** Todos os valores compartilhados de uma competência (percentuais, adiantamentos e bases das retenções). */
export async function listCampos(competencia: string): Promise<CamposCompartilhados> {
  const resultado = camposVazios();
  if (competencia === "") return resultado;
  await ensureSchema();
  const rows = await getDb()<{ campo: string; chave: string; valor: string }[]>`
    SELECT campo, chave, valor FROM faturamento_campos WHERE competencia = ${competencia}
  `;
  for (const r of rows) if (r.campo in resultado) resultado[r.campo as Campo][r.chave] = r.valor;
  return resultado;
}

/**
 * Grava (valor com texto) ou apaga (valor null/vazio) vários valores de UM campo numa competência, de uma vez. Cada chave é
 * independente: duas pessoas mexendo em colaboradores diferentes nunca se sobrescrevem. Devolve quantas chaves mudaram.
 */
export async function salvarCampos(competencia: string, campo: Campo, alteracoes: Record<string, string | null>, usuarioEmail: string | null): Promise<number> {
  const entradas = Object.entries(alteracoes).slice(0, LIMITES.alteracoes);
  if (entradas.length === 0) return 0;
  await ensureSchema();
  const sql = getDb();

  const gravar = entradas.filter(([, v]) => typeof v === "string" && v.trim() !== "") as [string, string][];
  const apagar = entradas.filter(([, v]) => v === null || (typeof v === "string" && v.trim() === "")).map(([k]) => k);

  await sql.begin(async (tx) => {
    if (gravar.length > 0) {
      await tx`
        INSERT INTO faturamento_campos (competencia, campo, chave, valor, atualizado_por, atualizado_em)
        SELECT ${competencia}, ${campo}, k, v, ${usuarioEmail}, now()
        FROM unnest(${gravar.map(([k]) => k)}::text[], ${gravar.map(([, v]) => v)}::text[]) AS t(k, v)
        ON CONFLICT (competencia, campo, chave) DO UPDATE SET valor = excluded.valor, atualizado_por = excluded.atualizado_por, atualizado_em = now()
      `;
    }
    if (apagar.length > 0) {
      await tx`DELETE FROM faturamento_campos WHERE competencia = ${competencia} AND campo = ${campo} AND chave = ANY(${apagar}::text[])`;
    }
  });
  return entradas.length;
}
