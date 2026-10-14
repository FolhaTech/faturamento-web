import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/lib/auth/sessao";
import { ehCampo, LIMITES } from "@/lib/camposCompartilhados";
import { listCampos, salvarCampos } from "@/lib/repo/camposFaturamento";

export const runtime = "nodejs";

/** Valores compartilhados da competência (% a deduzir, adiantamento, base das retenções) — ver faturamento_campos em db.ts. */
export async function GET(request: Request) {
  const competencia = new URL(request.url).searchParams.get("competencia")?.trim() ?? "";
  if (competencia === "" || competencia.length > LIMITES.competencia) return NextResponse.json({ error: "Informe a competência." }, { status: 400 });
  return NextResponse.json(await listCampos(competencia));
}

/** Grava ou apaga valores de um campo: { competencia, campo, alteracoes: { chave: "texto" | null } } — null ou vazio apaga. */
export async function PUT(request: Request) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ error: "Sessão expirada — faça login de novo." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const competencia = typeof body?.competencia === "string" ? body.competencia.trim() : "";
  const campo = body?.campo;
  const alteracoes = body?.alteracoes;
  if (competencia === "" || competencia.length > LIMITES.competencia || !ehCampo(campo) || !alteracoes || typeof alteracoes !== "object" || Array.isArray(alteracoes)) {
    return NextResponse.json({ error: "Informe competencia, campo (percentual|adiantamento|base|inss) e alteracoes." }, { status: 400 });
  }

  const limpas: Record<string, string | null> = {};
  for (const [chave, valor] of Object.entries(alteracoes as Record<string, unknown>)) {
    if (chave === "" || chave.length > LIMITES.chave) return NextResponse.json({ error: "Chave inválida." }, { status: 400 });
    if (valor !== null && typeof valor !== "string") return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
    if (typeof valor === "string" && valor.length > LIMITES.valor) return NextResponse.json({ error: "Valor longo demais." }, { status: 400 });
    limpas[chave] = valor;
  }
  if (Object.keys(limpas).length > LIMITES.alteracoes) return NextResponse.json({ error: "Alterações demais de uma vez." }, { status: 400 });

  const alteradas = await salvarCampos(competencia, campo, limpas, usuario.email);
  return NextResponse.json({ alteradas });
}
