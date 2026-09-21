import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Hash + salt (scrypt, Node built-in) — sem dependência nova nem segredo externo pra gerenciar. */
export function hashSenha(senha: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(senha, salt, 64).toString("hex");
  return { hash, salt };
}

/** Compara em tempo constante — evita vazar quanto do hash bateu por diferença de tempo de resposta. */
export function verificaSenha(senha: string, hash: string, salt: string): boolean {
  const tentativa = scryptSync(senha, salt, 64);
  const armazenado = Buffer.from(hash, "hex");
  if (tentativa.length !== armazenado.length) return false;
  return timingSafeEqual(tentativa, armazenado);
}
