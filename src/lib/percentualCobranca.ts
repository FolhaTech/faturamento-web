/** "80", "80,5", "80.5" ou "80%" -> número; vazio, inválido, negativo ou acima de 1000 -> null. */
export function lerPercentual(texto: string): number | null {
  const limpo = texto.trim().replace("%", "").trim().replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? n : null;
}

/** Valor a cobrar = percentual do Total (NF) do colaborador, arredondado em centavos. */
export function valorACobrar(total: number, percentual: number): number {
  return Math.round(((total * percentual) / 100) * 100) / 100;
}

export interface CobrancaColaborador {
  /** O que será cobrado do colaborador: o percentual da Nota Fiscal dele (sem percentual = a NF inteira). */
  cobrar: number;
  /** O que sai do total dele: Nota Fiscal − valor a cobrar (sem percentual = 0). */
  deduzido: number;
}

/** Valor a cobrar e valor deduzido de UM colaborador, a partir da Nota Fiscal dele e do percentual digitado (null = não definido). */
export function calcularCobranca(nf: number, percentual: number | null): CobrancaColaborador {
  if (percentual === null) return { cobrar: nf, deduzido: 0 };
  const cobrar = valorACobrar(nf, percentual);
  return { cobrar, deduzido: Math.round((nf - cobrar) * 100) / 100 };
}

/** Percentuais por matrícula no formato do link do PDF: "90103398:80,90103430:72.5". Só entra quem tem percentual válido. */
export function serializarPercentuais(percentuais: Map<number, number>): string {
  return [...percentuais].map(([matricula, p]) => `${matricula}:${p}`).join(",");
}

/** Inverso de serializarPercentuais — ignora pares malformados (nunca derruba a exportação por causa de um parâmetro ruim). */
export function lerPercentuaisSerializados(texto: string | null): Map<number, number> {
  const resultado = new Map<number, number>();
  for (const par of (texto ?? "").split(",")) {
    const [m, p] = par.split(":");
    const matricula = Number(m);
    const percentual = lerPercentual(p ?? "");
    if (Number.isInteger(matricula) && matricula > 0 && percentual !== null) resultado.set(matricula, percentual);
  }
  return resultado;
}
