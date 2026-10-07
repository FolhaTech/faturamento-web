/** "80", "80,5", "80.5" ou "80%" -> número; vazio, inválido, negativo ou acima de 1000 -> null. */
export function lerPercentual(texto: string): number | null {
  const limpo = texto.trim().replace("%", "").trim().replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  return Number.isFinite(n) && n >= 0 && n <= 1000 ? n : null;
}

/** Valor a cobrar = percentual do Total fatura (com encargos), arredondado em centavos. */
export function valorACobrar(totalFatura: number, percentual: number): number {
  return Math.round(((totalFatura * percentual) / 100) * 100) / 100;
}
