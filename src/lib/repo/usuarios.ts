import { randomBytes } from "node:crypto";
import { hashSenha, verificaSenha } from "../auth/senha";
import { ensureSchema, getDb } from "../db";

export interface Usuario {
  email: string;
  nome: string;
}

interface UsuarioRow {
  email: string;
  nome: string;
  senha_hash: string;
  senha_salt: string;
}

const DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

/** true se já existe uma conta com esse e-mail. */
export async function usuarioExiste(email: string): Promise<boolean> {
  await ensureSchema();
  const rows = await getDb()<{ email: string }[]>`SELECT email FROM usuarios WHERE email = ${email.toLowerCase()}`;
  return rows.length > 0;
}

/** Cria a conta (senha já vem em texto puro aqui — é hasheada dentro desta função, nunca gravada crua). */
export async function criarUsuario(nome: string, email: string, senha: string): Promise<Usuario> {
  await ensureSchema();
  const { hash, salt } = hashSenha(senha);
  const emailNormalizado = email.toLowerCase();
  await getDb()`
    INSERT INTO usuarios (email, nome, senha_hash, senha_salt)
    VALUES (${emailNormalizado}, ${nome}, ${hash}, ${salt})
  `;
  return { email: emailNormalizado, nome };
}

/** Confere e-mail/senha — retorna o usuário se bater, ou null (credenciais erradas ou conta inexistente). */
export async function verificarCredenciais(email: string, senha: string): Promise<Usuario | null> {
  await ensureSchema();
  const rows = await getDb()<UsuarioRow[]>`SELECT * FROM usuarios WHERE email = ${email.toLowerCase()}`;
  const row = rows[0];
  if (!row) return null;
  if (!verificaSenha(senha, row.senha_hash, row.senha_salt)) return null;
  return { email: row.email, nome: row.nome };
}

/** Cria uma sessão (token opaco aleatório) pro e-mail dado — token vai num cookie httpOnly, validado contra esta tabela a cada requisição (ver proxy.ts). */
export async function criarSessao(email: string): Promise<{ token: string; expiraEm: Date }> {
  await ensureSchema();
  const token = randomBytes(32).toString("hex");
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS);
  await getDb()`
    INSERT INTO sessoes (token, usuario_email, expira_em)
    VALUES (${token}, ${email.toLowerCase()}, ${expiraEm.toISOString()})
  `;
  return { token, expiraEm };
}

/** Usuário dono da sessão, se o token existir e ainda não tiver expirado — null caso contrário (proxy.ts redireciona pro login). */
export async function getUsuarioPorSessao(token: string): Promise<Usuario | null> {
  await ensureSchema();
  const rows = await getDb()<{ email: string; nome: string }[]>`
    SELECT u.email, u.nome FROM sessoes s
    JOIN usuarios u ON u.email = s.usuario_email
    WHERE s.token = ${token} AND s.expira_em > now()
  `;
  return rows[0] ?? null;
}

/** Apaga a sessão — usado no logout. */
export async function destruirSessao(token: string): Promise<void> {
  await ensureSchema();
  await getDb()`DELETE FROM sessoes WHERE token = ${token}`;
}
