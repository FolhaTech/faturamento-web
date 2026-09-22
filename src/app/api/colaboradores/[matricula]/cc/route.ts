import { NextResponse } from "next/server";
import { updateCc } from "@/lib/repo/colaboradores";

export const runtime = "nodejs";

/** CC do colaborador — campo opcional digitado na tela de Faturamento (ver FaturamentoViewer.tsx), aparece no PDF. */
export async function PUT(request: Request, { params }: { params: Promise<{ matricula: string }> }) {
  const { matricula } = await params;
  const body = await request.json().catch(() => null);
  const ccBruto = typeof body?.cc === "string" ? body.cc.trim() : "";
  const cc = ccBruto === "" ? null : ccBruto;

  try {
    const colaborador = await updateCc(Number(matricula), cc);
    return NextResponse.json({ colaborador });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao salvar.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
