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

/** Valor que corresponde a `percentual`% de `total`, arredondado em centavos. */
export function valorDoPercentual(total: number, percentual: number): number {
  return Math.round(((total * percentual) / 100) * 100) / 100;
}

export interface CobrancaColaborador {
  /** O que será cobrado do colaborador: a Nota Fiscal dele menos o valor deduzido (sem dedução = a NF inteira). */
  cobrar: number;
  /** O que sai do total dele: o percentual digitado aplicado à Nota Fiscal (sem dedução = 0). */
  deduzido: number;
}

/** Valor a cobrar e valor deduzido de UM colaborador, a partir da Nota Fiscal e do percentual a deduzir (null ou 0 = sem dedução). */
export function calcularCobranca(nf: number, percentual: number | null): CobrancaColaborador {
  if (percentual === null || percentual <= 0) return { cobrar: nf, deduzido: 0 };
  const deduzido = valorDoPercentual(nf, percentual);
  return { cobrar: Math.round((nf - deduzido) * 100) / 100, deduzido };
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
