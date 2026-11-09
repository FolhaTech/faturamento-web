import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/lib/auth/sessao";
import { listCcustosCadastrados, unificarCentrosDeCusto } from "@/lib/repo/colaboradores";
import { resolverCcustoInformado } from "@/lib/xlsx/ccustoDoNomeArquivo";

export const runtime = "nodejs";

/** Trava de segurança: quantos centros de custo se juntam de uma vez e o tamanho do nome — corpo fora disso é erro de uso, não pedido válido. */
const MAX_CENTROS = 50;
const MAX_NOME = 100;

/**
 * Junta centros de custo num só (ver UnificarCentrosDeCusto.tsx): { codigos: ["CHAMA LOGISTICO - FOLHA 1026", ...], nome: "CHAMA LOGISTICO" }.
 * O centro de destino é o já cadastrado com esse nome (ignora acento/maiúscula) ou, se não existir, um novo cujo código é o nome em
 * maiúsculas — a mesma regra do "Centro de custo deste arquivo" do upload (ver resolverCcustoInformado). Responde com quantos
 * colaboradores mudaram e o centro de destino.
 */
export async function PUT(request: Request) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ error: "Sessão expirada — faça login de novo." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const codigos: unknown = body?.codigos;
  const nome = typeof body?.nome === "string" ? body.nome.trim().replace(/\s+/g, " ") : "";

  if (!Array.isArray(codigos) || codigos.length === 0 || !codigos.every((c) => typeof c === "string" && c.trim() !== "")) {
    return NextResponse.json({ error: "Escolha os centros de custo que serão unificados." }, { status: 400 });
  }
  if (codigos.length > MAX_CENTROS) return NextResponse.json({ error: `Centros de custo demais de uma vez (máximo ${MAX_CENTROS}).` }, { status: 400 });
  if (nome === "" || nome.length > MAX_NOME) return NextResponse.json({ error: `Informe o nome do centro de custo final (até ${MAX_NOME} caracteres).` }, { status: 400 });

  try {
    const destino = resolverCcustoInformado(nome, await listCcustosCadastrados());
    if (!destino) return NextResponse.json({ error: "Informe o nome do centro de custo final." }, { status: 400 });
    const atualizados = await unificarCentrosDeCusto(codigos as string[], destino);
    return NextResponse.json({ atualizados, destino });
  } catch (err) {
    console.error("[faturamento/unificar-centros-de-custo] erro:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Falha ao unificar." }, { status: 500 });
  }
}
