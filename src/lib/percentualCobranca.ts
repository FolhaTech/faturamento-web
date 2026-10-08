function arredonda(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Percentual a DEDUZIR da Nota Fiscal de um colaborador: "20", "20,5", "20.5" ou "20%" -> número;
 * vazio, inválido, negativo ou acima de 100 -> null.
 */
export function lerPercentual(texto: string): number | null {
  const limpo = texto.trim().replace("%", "").trim().replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

/** O percentual aplicado de verdade: 0% (ou vazio/inválido) é "sem dedução" — o valor do colaborador fica normal. */
export function percentualAtivo(texto: string): number | null {
  const p = lerPercentual(texto);
  return p !== null && p > 0 ? p : null;
}

/**
 * Valor em reais digitado: "1500", "1.500,50", "1500,5", "1500.5" ou "R$ 1.500,50" -> número em centavos;
 * vazio, inválido ou negativo -> null. "1.500" (ponto com 3 casas no fim) é milhar, como se escreve no Brasil.
 */
export function lerValorReais(texto: string): number | null {
  let limpo = texto.trim().replace(/^R\$\s*/i, "").replace(/\s+/g, "");
  if (limpo === "") return null;
  if (limpo.includes(",")) limpo = limpo.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) limpo = limpo.replace(/\./g, "");
  const n = Number(limpo);
  return Number.isFinite(n) && n >= 0 ? arredonda(n) : null;
}

/** O adiantamento aplicado de verdade: R$ 0 (ou vazio/inválido) é "sem adiantamento". */
export function adiantamentoAtivo(texto: string): number | null {
  const v = lerValorReais(texto);
  return v !== null && v > 0 ? v : null;
}

/** Valor que corresponde a `percentual`% de `total`, arredondado em centavos. */
export function valorDoPercentual(total: number, percentual: number): number {
  return arredonda((total * percentual) / 100);
}

export interface CobrancaColaborador {
  /** O que será cobrado do colaborador: a Nota Fiscal dele menos tudo que foi deduzido (sem dedução = a NF inteira). */
  cobrar: number;
  /** Total que sai da Nota Fiscal dele: dedução do percentual + adiantamento. */
  deduzido: number;
  /** Parte do deduzido que vem do percentual (percentual × NF). */
  deducaoPercentual: number;
  /** Parte do deduzido que vem do adiantamento (valor digitado, em reais). */
  adiantamento: number;
}

/**
 * Valor a cobrar e valor deduzido de UM colaborador, a partir da Nota Fiscal, do percentual a deduzir
 * (null ou 0 = sem percentual) e do adiantamento em reais (0 = sem adiantamento). As duas deduções saem
 * do total da Nota Fiscal do colaborador, somadas — o percentual NÃO incide sobre o adiantamento.
 */
export function calcularCobranca(nf: number, percentual: number | null, adiantamento = 0): CobrancaColaborador {
  const deducaoPercentual = percentual !== null && percentual > 0 ? valorDoPercentual(nf, percentual) : 0;
  const valorAdiantamento = adiantamento > 0 ? arredonda(adiantamento) : 0;
  const deduzido = arredonda(deducaoPercentual + valorAdiantamento);
  return { cobrar: arredonda(nf - deduzido), deduzido, deducaoPercentual, adiantamento: valorAdiantamento };
}

/** Percentuais por matrícula no formato do link do PDF: "90103398:20,90103430:7.5". Só entra quem tem dedução (> 0). */
export function serializarPercentuais(percentuais: Map<number, number>): string {
  return [...percentuais].filter(([, p]) => p > 0).map(([matricula, p]) => `${matricula}:${p}`).join(",");
}

/** Inverso de serializarPercentuais — ignora pares malformados e 0% (nunca derruba a exportação por causa de um parâmetro ruim). */
export function lerPercentuaisSerializados(texto: string | null): Map<number, number> {
  const resultado = new Map<number, number>();
  for (const par of (texto ?? "").split(",")) {
    const [m, p] = par.split(":");
    const matricula = Number(m);
    const percentual = percentualAtivo(p ?? "");
    if (Number.isInteger(matricula) && matricula > 0 && percentual !== null) resultado.set(matricula, percentual);
  }
  return resultado;
}

/** Adiantamentos por matrícula no formato do link do PDF: "90103398:1500,90103430:250.5". Só entra quem tem adiantamento (> 0). */
export function serializarAdiantamentos(adiantamentos: Map<number, number>): string {
  return [...adiantamentos].filter(([, v]) => v > 0).map(([matricula, v]) => `${matricula}:${v}`).join(",");
}

/** Inverso de serializarAdiantamentos — ignora pares malformados e valor 0. */
export function lerAdiantamentosSerializados(texto: string | null): Map<number, number> {
  const resultado = new Map<number, number>();
  for (const par of (texto ?? "").split(",")) {
    const [m, v] = par.split(":");
    const matricula = Number(m);
    const valor = adiantamentoAtivo(v ?? "");
    if (Number.isInteger(matricula) && matricula > 0 && valor !== null) resultado.set(matricula, valor);
  }
  return resultado;
}

/** O que foi digitado de dedução para UM colaborador (só entra quem tem percentual > 0 ou adiantamento > 0). */
export interface DeducaoColaborador {
  percentual: number | null;
  adiantamento: number;
}

/** Junta os percentuais e os adiantamentos (links do PDF) numa dedução por colaborador — quem tem só um dos dois entra com o outro vazio. */
export function juntarDeducoes(percentuais: Map<number, number>, adiantamentos: Map<number, number>): Map<number, DeducaoColaborador> {
  const resultado = new Map<number, DeducaoColaborador>();
  for (const matricula of new Set([...percentuais.keys(), ...adiantamentos.keys()])) {
    resultado.set(matricula, { percentual: percentuais.get(matricula) ?? null, adiantamento: adiantamentos.get(matricula) ?? 0 });
  }
  return resultado;
}

/**
 * Soma, sobre os colaboradores de um centro de custo, do que será cobrado, do que foi deduzido (percentual +
 * adiantamento) e de quanto disso é adiantamento. Quem não tem dedução entra com a Nota Fiscal inteira.
 * O `deduzido` também é o que reduz o "Valor líquido a receber" do centro de custo (tela e PDF).
 */
export function somarCobranca(
  colaboradores: { matricula: number; nf: number }[],
  deducoes: Map<number, DeducaoColaborador>,
): { cobrar: number; deduzido: number; adiantamentos: number } {
  let cobrar = 0;
  let deduzido = 0;
  let adiantamentos = 0;
  for (const c of colaboradores) {
    const d = deducoes.get(c.matricula);
    const r = calcularCobranca(c.nf, d?.percentual ?? null, d?.adiantamento ?? 0);
    cobrar += r.cobrar;
    deduzido += r.deduzido;
    adiantamentos += r.adiantamento;
  }
  return { cobrar: arredonda(cobrar), deduzido: arredonda(deduzido), adiantamentos: arredonda(adiantamentos) };
}
