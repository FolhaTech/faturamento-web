const DIACRITICOS = /[̀-ͯ]/g;

/** Maiúsculo, sem acento, sem espaços/asterisco nas pontas — para comparar nomes de evento entre fontes diferentes. */
export function normalizaTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .trim()
    .replace(/\*+$/, "")
    .trim()
    .toUpperCase();
}
