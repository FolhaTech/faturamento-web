import { normalizaTexto } from "../text";

export interface CcustoCadastrado {
  codigo: string;
  nome: string;
}

/** Extensão de planilha que sobra depois de tirar a última (arquivo salvo como "nome.xls.xlsx"). */
const EXTENSAO_PLANILHA_SOBRANDO = /\.(XLSX?|XLSM)$/;

/**
 * Nome do arquivo sem extensão, competência e numeração de cópia — ex.: "CARBRINK 092026 (1).xlsx"
 * vira "CARBRINK". Palavras de tipo (Folha/Prévia) também saem, pra "IPEC FOLHA 092026.xlsx" cair em "IPEC".
 */
export function nomeBaseDoArquivo(nomeArquivo: string): string {
  return normalizaTexto(nomeArquivo)
    .replace(/\.[A-Z0-9]+$/, "")
    .replace(EXTENSAO_PLANILHA_SOBRANDO, "") // "Movimentos xp 1140.xls.xlsx": a extensão dupla deixava ".XLS" no nome
    .replace(/\(\d+\)/g, " ")
    .replace(/[\d_]+/g, " ")
    .replace(/\b(FOLHA|PREVIA)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Centro de custo digitado pelo usuário no upload (campo "Centro de custo deste arquivo"): usa o já
 * cadastrado com esse nome (ignora acento/maiúscula) ou, se não existir, cria um novo cujo código é o
 * próprio nome em maiúsculas — mesmo padrão dos centros de custo que já usam o nome como código (ex.:
 * "CHAMA LOGISTICA", "ORIZON"). Nome ambíguo (mesmo nome com códigos diferentes) fica com o primeiro código em ordem alfabética.
 */
export function resolverCcustoInformado(texto: string, ccustos: CcustoCadastrado[]): CcustoCadastrado | null {
  const nome = texto.trim().replace(/\s+/g, " ");
  if (nome === "") return null;
  const casam = ccustos.filter((c) => normalizaTexto(c.nome) === normalizaTexto(nome)).sort((a, b) => a.codigo.localeCompare(b.codigo));
  if (casam.length > 0) return casam[0];
  const novo = nome.toUpperCase();
  return { codigo: novo, nome: novo };
}

/**
 * Texto que a tela de upload SUGERE (a pessoa confirma com um clique) para o campo "Centro de custo deste arquivo": o centro de
 * custo cadastrado que o nome do arquivo indica ("Movimentos cc1130.xls" -> "XP 1130") ou, sem casar com nenhum, o nome do arquivo
 * sem extensão, competência, cópia e as palavras Folha/Prévia/Movimentos — mantendo os números do nome ("Movimentos xp 1140.xls.xlsx"
 * -> "XP 1140", um centro de custo que ainda não existe). Só serve de sugestão: nada é gravado até a pessoa enviar o arquivo.
 * Vazio quando não sobra um nome com letras.
 */
export function sugestaoDeCcusto(nomeArquivo: string, ccustos: CcustoCadastrado[]): string {
  const cadastrado = ccustoDoNomeDoArquivo(nomeArquivo, ccustos);
  if (cadastrado) return cadastrado.nome;
  const texto = normalizaTexto(nomeArquivo)
    .replace(/\.[A-Z0-9]+$/, "")
    .replace(EXTENSAO_PLANILHA_SOBRANDO, "")
    .replace(/_/g, " ")
    .replace(/\(\d+\)/g, " ")
    .replace(/\b(0[1-9]|1[0-2])[ ._-]?20\d{2}\b/g, " ")
    .replace(/\b(FOLHA|PREVIA|MOVIMENTOS?)\b/g, " ")
    .replace(/\bCC[\s-]*(?=\d)/g, " ")
    .replace(/\s+/g, " ")
    .replace(/(?:^|\s)\d{1,2}$/, "") // numeração de cópia solta no fim ("... 1")
    .replace(/[\s-]+$/, "")
    .trim();
  return /[A-Z]/.test(texto) ? texto : "";
}

/** Sem zeros à esquerda, pra "01130" e "1130" serem o mesmo número. */
function semZerosAEsquerda(numero: string): string {
  return numero.replace(/^0+(?=\d)/, "");
}

/**
 * Número que o nome do arquivo marca como centro de custo com "CC" colado ou separado dele — "Movimentos cc1130.xls",
 * "Movimentos CC 1130 (1).xlsx", "movimentos_cc_1130.xlsx" -> "1130". null quando não há "CC" + número (o número solto, como
 * a competência "092026" ou o "1050" de "ITAU RH1050", nunca vale: só o marcador explícito "CC" deixa claro que é o centro de custo).
 */
export function numeroDoCcustoNoNome(nomeArquivo: string): string | null {
  const texto = normalizaTexto(nomeArquivo)
    .replace(/\.[A-Z0-9]+$/, "")
    .replace(/_/g, " ");
  const achado = texto.match(/(?:^|[^A-Z0-9])CC[\s-]*(\d+)(?![A-Z0-9])/);
  return achado ? semZerosAEsquerda(achado[1]) : null;
}

/**
 * Centro de custo indicado pelo NOME do arquivo — usado só quando a planilha não traz o Local de
 * trabalho (ver parseMovimentos.ts) pra dizer o cliente. Vale em dois casos:
 * - o nome base do arquivo é IGUAL a um centro de custo já cadastrado (ex.: "CARBRINK 092026.xlsx" -> "CARBRINK");
 * - o nome traz "CC" + número (ex.: "Movimentos cc1130.xls") e UM só centro de custo cadastrado tem esse número no nome
 *   (ex.: "XP 1130") — vários arquivos "Movimentos ccNNNN" de clientes diferentes viram o nome base igual ("MOVIMENTOS CC"),
 *   então o número é o que os distingue.
 * Nome que apenas parece com algum (ex.: "ITAU RH1050 FABI - FOLHA ...", sem "CC") não casa, pra nunca chutar.
 */
export function ccustoDoNomeDoArquivo(nomeArquivo: string, ccustos: CcustoCadastrado[]): CcustoCadastrado | null {
  const base = nomeBaseDoArquivo(nomeArquivo);
  if (base !== "") {
    const casam = ccustos.filter((c) => normalizaTexto(c.nome) === base);
    const codigos = new Set(casam.map((c) => c.codigo));
    if (codigos.size === 1) return casam[0];
    if (codigos.size > 1) return null; // mesmo nome com códigos diferentes: ambíguo, não chuta pelo número
  }

  const numero = numeroDoCcustoNoNome(nomeArquivo);
  if (numero === null) return null;
  const casam = ccustos.filter((c) => (normalizaTexto(c.nome).match(/\d+/g) ?? []).some((n) => semZerosAEsquerda(n) === numero));
  const codigos = new Set(casam.map((c) => c.codigo));
  return codigos.size === 1 ? casam[0] : null;
}
