import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/lib/auth/sessao";
import { completarCampos } from "@/lib/repo/camposFaturamento";
import { adotarFaturaSalva } from "@/lib/repo/faturasSalvas";

export const runtime = "nodejs";

/**
 * "Usar como minha versão": copia a fatura salva por outra pessoa (aberta pelo link "Ver esta versão" da timeline) como uma
 * entrada nova do usuário logado — ela passa a ser a versão ativa dele. A original continua intacta na timeline, de quem salvou.
 */
export async function POST(request: Request) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ error: "Sessão expirada — faça login de novo." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const competencia = typeof body?.competencia === "string" ? body.competencia : "";
  const versao = typeof body?.versao === "string" ? body.versao : "";
  if (!competencia || !versao) return NextResponse.json({ error: "Informe a competência e a versão." }, { status: 400 });

  const fatura = await adotarFaturaSalva(competencia, versao, usuario);
  if (!fatura) return NextResponse.json({ error: "Versão não encontrada nessa competência." }, { status: 404 });
  // Os valores de % a deduzir / adiantamento / base guardados nessa versão passam a valer também no banco compartilhado, mas só onde
  // ainda não há nada digitado — o que alguém já preencheu lá não é sobrescrito.
  if (fatura.campos) await completarCampos(competencia, fatura.campos, usuario.email);
  return NextResponse.json({ salvoEm: fatura.salvoEm });
}
