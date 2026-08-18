import { NextResponse } from "next/server";
import { listColaboradores, upsertColaborador } from "@/lib/repo/colaboradores";
import type { DadosColaborador } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const busca = url.searchParams.get("busca") ?? undefined;
  const situacao = url.searchParams.get("situacao") ?? undefined;
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "25");

  const result = listColaboradores({ busca, situacao, page, pageSize });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { dados?: DadosColaborador };
  const dados = body?.dados ?? {};
  const matricula = Number(dados.cod_epr);

  if (!matricula) {
    return NextResponse.json({ error: 'Informe "Cód Epr" (matrícula) — é a chave do colaborador.' }, { status: 400 });
  }
  if (!dados.nome || String(dados.nome).trim() === "") {
    return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
  }

  const colaborador = upsertColaborador({ matricula, dados });
  return NextResponse.json({ colaborador }, { status: 201 });
}
