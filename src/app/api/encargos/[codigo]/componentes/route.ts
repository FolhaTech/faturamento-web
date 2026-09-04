import { NextResponse } from "next/server";
import { updateEncargoComponentes } from "@/lib/repo/encargos";
import type { TipoEvento } from "@/lib/types";

export const runtime = "nodejs";

const TIPOS: TipoEvento[] = ["P", "D", "I", "R", "FGTS", "INSS"];

/** Liga/desliga em bloco INSS, FGTS e Provisões de um evento com as alíquotas padrão — usado pelos checkboxes rápidos da tela de Faturamento (ver updateEncargoComponentes em repo/encargos.ts). */
export async function PATCH(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const body = await request.json();
  const { evento, tipo, inss, fgts, provisoes } = body ?? {};

  if (typeof evento !== "string" || !evento.trim()) return NextResponse.json({ error: "Informe o evento." }, { status: 400 });
  const tipoFinal: TipoEvento = TIPOS.includes(tipo) ? tipo : "P";
  if (typeof inss !== "boolean" || typeof fgts !== "boolean" || typeof provisoes !== "boolean") {
    return NextResponse.json({ error: "inss, fgts e provisoes devem ser booleanos." }, { status: 400 });
  }

  const encargo = await updateEncargoComponentes(Number(codigo), evento.trim(), tipoFinal, { inss, fgts, provisoes });
  return NextResponse.json({ encargo });
}
