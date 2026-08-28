import { ensureSchema, getDb } from "../db";

/** Chave da configuração de valor de PLR aplicado a todo colaborador celetista — ver generatePlrCharges em engine.ts. */
export const CHAVE_PLR_CELETISTA = "plr_celetista";

export async function getConfigNumero(chave: string, padrao: number): Promise<number> {
  await ensureSchema();
  const rows = await getDb()<{ valor: number }[]>`SELECT valor FROM configuracoes WHERE chave = ${chave}`;
  return rows[0] ? rows[0].valor : padrao;
}

export async function setConfigNumero(chave: string, valor: number): Promise<void> {
  await ensureSchema();
  await getDb()`
    INSERT INTO configuracoes (chave, valor) VALUES (${chave}, ${valor})
    ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor
  `;
}
