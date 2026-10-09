/** "2026-09-08" -> "08/09/2026" (sem passar por Date, pra fuso horário nunca mudar o dia). Vazio/inválido -> null. */
export function formatarDataBr(iso: string | null | undefined): string | null {
  const m = (iso ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}
