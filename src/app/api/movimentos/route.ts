import { NextResponse } from "next/server";
import { aplicarAbatimentoFerias } from "@/lib/calc/abatimentoFerias";
import { upsertColaboradoresPendentes } from "@/lib/repo/colaboradores";
import { countMovimentos, listCompetencias, replaceMovimentosPorCompetencia } from "@/lib/repo/movimentos";
import { parseMovimentosFile } from "@/lib/xlsx/parseMovimentos";

export const runtime = "nodejs";

export async function GET() {
  const [competencias, total] = await Promise.all([listCompetencias(), countMovimentos()]);
  return NextResponse.json({ competencias, total });
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

  // Matrícula do arquivo sem cadastro em Colaboradores: cria um cadastro mínimo (sem Tomador) em vez de só
  // descartar o lançamento — fica visível pra completar, e assim que tiver Cód Serviço entra no faturamento.
  const cadastrosNovos = await upsertColaboradoresPendentes(linhas.map((l) => ({ matricula: l.matricula, nome: l.nome })));

  // Precisa rodar ANTES de substituir os lançamentos: devolve ao saldo o que um upload anterior
  // dessa(s) competência(s) já tinha abatido, antes de calcular o abatimento em cima do arquivo novo.
  const linhasComAbatimento = await aplicarAbatimentoFerias(linhas);

  await replaceMovimentosPorCompetencia(linhasComAbatimento);
  const competencias = [...new Set(linhas.map((l) => l.competencia))];

  return NextResponse.json({
    importados: linhas.length,
    competencias,
    cadastrosNovos: cadastrosNovos.map((c) => ({ matricula: c.matricula, nome: c.nome })),
  });
}
