import { NextResponse } from "next/server";
import { updateDescontoProvisaoFlags } from "@/lib/repo/colaboradores";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ matricula: string }> }) {
  const { matricula } = await params;
  const body = (await request.json()) as { descontarProvFerias?: unknown; descontarProv13?: unknown };

  try {
    const colaborador = await updateDescontoProvisaoFlags(Number(matricula), {
      descontarProvFerias: body.descontarProvFerias === true || body.descontarProvFerias === "1" || body.descontarProvFerias === 1,
      descontarProv13: body.descontarProv13 === true || body.descontarProv13 === "1" || body.descontarProv13 === 1,
    });
    return NextResponse.json({ colaborador });
  } catch (error) {
    console.error("[desconto-provisao] erro ao salvar flags:", error);
    const message = error instanceof Error ? error.message : "Erro ao salvar flags.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
