import { normalizaTexto } from "../text";

export interface CcustoCadastrado {
  codigo: string;
  nome: string;
}

/**
 * Nome do arquivo sem extensão, competência e numeração de cópia — ex.: "CARBRINK 092026 (1).xlsx"
 * vira "CARBRINK". Palavras de tipo (Folha/Prévia) também saem, pra "IPEC FOLHA 092026.xlsx" cair em "IPEC".
 */
export function nomeBaseDoArquivo(nomeArquivo: string): string {
  return normalizaTexto(nomeArquivo)
    .replace(/\.[A-Z0-9]+$/, "")
    .replace(/\(\d+\)/g, " ")
    .replace(/[\d_]+/g, " ")
    .replace(/\b(FOLHA|PREVIA)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Centro de custo indicado pelo NOME do arquivo — usado só quando a planilha não traz o Local de
 * trabalho (ver parseMovimentos.ts) pra dizer o cliente. Só vale quando o nome base do arquivo é
 * IGUAL a um centro de custo já cadastrado (ex.: "CARBRINK 092026.xlsx" -> "CARBRINK"); nome que
 * apenas parece com algum (ex.: "ITAU RH1050 FABI - FOLHA ...") não casa, pra nunca chutar.
 */
export function ccustoDoNomeDoArquivo(nomeArquivo: string, ccustos: CcustoCadastrado[]): CcustoCadastrado | null {
  const base = nomeBaseDoArquivo(nomeArquivo);
  if (base === "") return null;
  const casam = ccustos.filter((c) => normalizaTexto(c.nome) === base);
  const codigos = new Set(casam.map((c) => c.codigo));
  return codigos.size === 1 ? casam[0] : null;
}
