import { NextResponse } from "next/server";
import { countMovimentos, listCompetencias, replaceMovimentosPorCompetencia } from "@/lib/repo/movimentos";
import { parseMovimentosFile } from "@/lib/xlsx/parseMovimentos";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ competencias: listCompetencias(), total: countMovimentos() });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Envie o arquivo no campo "file".' }, { status: 400 });
  }
  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
    return NextResponse.json({ error: "Formato inválido — envie um arquivo .xlsx ou .xls." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let linhas;
  try {
    linhas = await parseMovimentosFile(buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao ler o arquivo.";
    return NextResponse.json({ error: `Não foi possível ler o arquivo: ${message}` }, { status: 422 });
  }

  if (linhas.length === 0) {
    return NextResponse.json({ error: "Nenhum lançamento reconhecido no arquivo." }, { status: 422 });
  }

  replaceMovimentosPorCompetencia(linhas);
  const competencias = [...new Set(linhas.map((l) => l.competencia))];

  return NextResponse.json({ importados: linhas.length, competencias });
}
