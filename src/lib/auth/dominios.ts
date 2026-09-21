/**
 * Domínios de e-mail liberados pra CADASTRO (não pra login — quem já tem conta continua
 * entrando normalmente mesmo que essa lista mude depois). Fixo no código de propósito, não em
 * variável de ambiente nem tabela — é regra de negócio, não segredo.
 */
const DOMINIOS_CADASTRO_PERMITIDOS = ["genter", "arantesarimura", "folhate"];

/** true se o domínio do e-mail (parte depois do @) contém um dos prefixos liberados pra cadastro. */
export function dominioPermitidoParaCadastro(email: string): boolean {
  const dominio = email.toLowerCase().split("@")[1] ?? "";
  return DOMINIOS_CADASTRO_PERMITIDOS.some((d) => dominio.includes(d));
}
