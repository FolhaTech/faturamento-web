import { NextResponse } from "next/server";
import { deleteColaborador, getColaborador, upsertColaborador } from "@/lib/repo/colaboradores";
import type { DadosColaborador } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ matricula: string }> }) {
  const { matricula } = await params;
  const colaborador = getColaborador(Number(matricula));
  if (!colaborador) return NextResponse.json({ error: "Colaborador não encontrado." }, { status: 404 });
  return NextResponse.json({ colaborador });
}

export async function PUT(request: Request, { params }: { params: Promise<{ matricula: string }> }) {
  const { matricula } = await params;
  const body = (await request.json()) as { dados?: DadosColaborador };
  const enviado = body?.dados ?? {};

  if (!enviado.nome || String(enviado.nome).trim() === "") {
    return NextResponse.json({ error: "Informe o nome." }, { status: 400 });
  }

  // Mescla com o registro existente: um PUT que não traga todos os 124 campos
  // (ex. chamada direta na API, não pelo formulário) não deve apagar o resto do cadastro.
  const existente = getColaborador(Number(matricula));
  const dados: DadosColaborador = { ...(existente?.dados ?? {}), ...enviado };

  // matrícula é a chave primária: mantém a da URL mesmo que o campo "Cód Epr" no formulário tenha sido alterado por engano.
  dados.cod_epr = Number(matricula);
  const colaborador = upsertColaborador({ matricula: Number(matricula), dados });
  return NextResponse.json({ colaborador });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ matricula: string }> }) {
  const { matricula } = await params;
  deleteColaborador(Number(matricula));
  return NextResponse.json({ ok: true });
}
