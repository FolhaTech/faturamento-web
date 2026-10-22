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

/** Sem zeros à esquerda, pra "01130" e "1130" serem o mesmo número. */
function semZerosAEsquerda(numero: string): string {
  return numero.replace(/^0+(?=\d)/, "");
}

/**
 * Nome do arquivo reduzido ao que identifica o centro de custo: sem extensão (inclusive a dupla), competência, cópia, marcador
 * "CC" e as palavras Folha/Prévia/Movimentos — mantendo os números do nome. "Movimentos xp 1140.xls.xlsx" -> "XP 1140";
 * "CARBRINK 092026 (1).xlsx" -> "CARBRINK". Vazio quando não sobra um nome com letras.
 */
function nomeLimpoDoArquivo(nomeArquivo: string): string {
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

/** "XP 1140" -> prefixo "XP" e código "1140": nome de centro de custo no padrão "<CLIENTE> <código de 3 a 5 dígitos>". */
const NOME_COM_CODIGO_NO_FIM = /^(.*[A-Z].*?)\s+(\d{3,5})$/;

/**
 * Número que o nome do arquivo marca como centro de custo com "CC" colado ou separado dele — "Movimentos cc1130.xls",
 * "Movimentos CC 1130 (1).xlsx", "movimentos_cc_1130.xlsx" -> "1130". null quando não há "CC" + número.
 */
export function numeroDoCcustoNoNome(nomeArquivo: string): string | null {
  const texto = normalizaTexto(nomeArquivo)
    .replace(/\.[A-Z0-9]+$/, "")
    .replace(EXTENSAO_PLANILHA_SOBRANDO, "")
    .replace(/_/g, " ");
  const achado = texto.match(/(?:^|[^A-Z0-9])CC[\s-]*(\d+)(?![A-Z0-9])/);
  return achado ? semZerosAEsquerda(achado[1]) : null;
}

/**
 * Centro de custo indicado pelo NOME do arquivo — usado quando a planilha não traz o Local de trabalho (ver parseMovimentos.ts)
 * pra dizer o cliente e a pessoa não digitou um no upload. Vale em três casos, nesta ordem:
 * 1. o nome base do arquivo é IGUAL a um centro de custo já cadastrado (ex.: "CARBRINK 092026.xlsx" -> "CARBRINK");
 * 2. o nome traz "CC" + número (ex.: "Movimentos cc1130.xls") e UM só centro de custo cadastrado tem esse número no nome
 *    (ex.: "XP 1130"); número que nenhum ou mais de um tem não chuta;
 * 3. o nome, limpo (ex.: "Movimentos xp 1140.xls.xlsx" -> "XP 1140"), tem o padrão "<CLIENTE> <código>" e já existe um centro de custo
 *    do mesmo cliente nesse padrão (XP 1120, XP 1130): ele é igual a um cadastrado (usa o cadastrado) ou um centro de custo
 *    novo da mesma família, que passa a existir com o código igual ao nome (como "CHAMA LOGISTICA"). Código que parece ano
 *    (2026) não vale.
 * Nome que apenas parece com algum (ex.: "ITAU RH1050 FABI - FOLHA ...", sem código no fim) não casa, pra nunca chutar.
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
  if (numero !== null) {
    const casam = ccustos.filter((c) => (normalizaTexto(c.nome).match(/\d+/g) ?? []).some((n) => semZerosAEsquerda(n) === numero));
    const codigos = new Set(casam.map((c) => c.codigo));
    if (codigos.size === 1) return casam[0];
    if (codigos.size > 1) return null;
  }

  const nome = nomeLimpoDoArquivo(nomeArquivo);
  const padrao = nome.match(NOME_COM_CODIGO_NO_FIM);
  if (!padrao || /^20\d{2}$/.test(padrao[2])) return null;
  const jaExiste = ccustos.some((c) => normalizaTexto(c.nome) === nome);
  const mesmaFamilia = ccustos.some((c) => normalizaTexto(c.nome).match(NOME_COM_CODIGO_NO_FIM)?.[1] === padrao[1]);
  return jaExiste || mesmaFamilia ? resolverCcustoInformado(nome, ccustos) : null;
}

/**
 * O centro de custo que TODOS os colaboradores do arquivo que têm um centro de custo compartilham — usado pra completar quem ficou
 * sem nenhum (cadastro vazio, planilha e nome do arquivo sem indicação, e nenhum colaborador ANTES dele no arquivo com centro de
 * custo pra herdar: o primeiro da lista nunca recebia). null quando ninguém tem centro de custo ou há mais de um (arquivo misturado:
 * aí não dá pra saber de qual é quem ficou de fora, não chuta).
 */
export function ccustoUnicoDoArquivo(ccustosDoArquivo: CcustoCadastrado[]): CcustoCadastrado | null {
  const codigos = new Set(ccustosDoArquivo.map((c) => c.codigo));
  return codigos.size === 1 ? { codigo: ccustosDoArquivo[0].codigo, nome: ccustosDoArquivo[0].nome } : null;
}

/**
 * Texto que a tela de upload mostra como sugestão do campo "Centro de custo deste arquivo": o centro de custo que o nome do
 * arquivo indica (ver ccustoDoNomeDoArquivo) ou, sem indicar nenhum, o nome limpo do arquivo ("ITAU RH1050 FABI") — esse último
 * só como atalho de um clique, nunca aplicado sozinho. Vazio quando não sobra um nome com letras.
 */
export function sugestaoDeCcusto(nomeArquivo: string, ccustos: CcustoCadastrado[]): string {
  return ccustoDoNomeDoArquivo(nomeArquivo, ccustos)?.nome ?? nomeLimpoDoArquivo(nomeArquivo);
}
