/**
 * Valores digitados na tela de Faturamento e COMPARTILHADOS entre usuários (gravados em faturamento_campos):
 * - percentual: % a deduzir da Nota Fiscal de cada colaborador (chave = matrícula);
 * - adiantamento: adiantamento em R$ de cada colaborador (chave = matrícula);
 * - base: base das retenções em R$ de cada centro de custo (chave = código do centro de custo).
 * Cada valor é o texto como foi digitado ("20,5", "1.500,00"); quem usa converte (lerPercentual, lerValorReais).
 */
export const CAMPOS = ["percentual", "adiantamento", "base"] as const;
export type Campo = (typeof CAMPOS)[number];

export type Valores = Record<string, string>;
export type CamposCompartilhados = Record<Campo, Valores>;

export function ehCampo(valor: unknown): valor is Campo {
  return typeof valor === "string" && (CAMPOS as readonly string[]).includes(valor);
}

export function camposVazios(): CamposCompartilhados {
  return { percentual: {}, adiantamento: {}, base: {} };
}

/**
 * Lê o JSON dos valores guardados numa fatura salva (coluna campos). null quando não há (versão de antes de os valores serem
 * guardados) ou o texto não é um JSON utilizável; dentro dele, só ficam os valores em texto não vazio dos três campos conhecidos.
 */
export function lerCamposSalvos(json: string | null | undefined): CamposCompartilhados | null {
  if (!json) return null;
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    return null;
  }
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return null;
  const resultado = camposVazios();
  for (const campo of CAMPOS) {
    const valores = (bruto as Record<string, unknown>)[campo];
    if (!valores || typeof valores !== "object" || Array.isArray(valores)) continue;
    for (const [chave, valor] of Object.entries(valores)) {
      if (typeof valor === "string" && valor.trim() !== "") resultado[campo][chave] = valor;
    }
  }
  return resultado;
}

/** Limites do que a API aceita gravar — texto digitado curto, nada de lixo no banco. */
export const LIMITES = { competencia: 100, chave: 100, valor: 40, alteracoes: 1000 } as const;

/** Aplica uma alteração (valor null ou vazio = apaga) sem mexer no objeto original. */
export function aplicarAlteracao(valores: Valores, chave: string, novo: string | null): Valores {
  const proximo = { ...valores };
  if (novo === null || novo.trim() === "") delete proximo[chave];
  else proximo[chave] = novo;
  return proximo;
}

/**
 * Junta o que veio do servidor com o que está na tela: o servidor manda (é o que os outros usuários gravaram), exceto nas
 * chaves em `pendentes` — as que a própria pessoa digitou e ainda não foram confirmadas pelo servidor — que ficam como estão
 * na tela (inclusive "apagado"), pra uma atualização em segundo plano nunca engolir o que está sendo digitado.
 */
export function mesclarComPendentes(local: Valores, servidor: Valores, pendentes: ReadonlySet<string>): Valores {
  const resultado: Valores = { ...servidor };
  for (const chave of pendentes) {
    if (chave in local) resultado[chave] = local[chave];
    else delete resultado[chave];
  }
  return resultado;
}

/**
 * O que ainda não existe no servidor entre os valores antigos do navegador (localStorage, de antes de os valores serem
 * compartilhados) — vira o conjunto a subir uma única vez. Valor já gravado no servidor nunca é sobrescrito pelo antigo.
 */
export function valoresFaltandoNoServidor(antigos: Valores, servidor: Valores): Valores {
  const faltando: Valores = {};
  for (const [chave, valor] of Object.entries(antigos)) {
    if (typeof valor === "string" && valor.trim() !== "" && !(chave in servidor)) faltando[chave] = valor;
  }
  return faltando;
}
