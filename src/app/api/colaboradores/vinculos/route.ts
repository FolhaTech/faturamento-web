import { NextResponse } from "next/server";
import { atualizarVinculosEmLote, importarColaboradoresEmLote } from "@/lib/repo/colaboradores";
import { parseCadastrosEmpregadosFile, parseEmpregadosFile } from "@/lib/xlsx/parseEmpregados";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Upload mensal da planilha "Empregados em Excel" do sistema de folha: atualiza a admissão e a rescisão (data e motivo)
 * dos colaboradores já cadastrados, pra aparecerem no Faturamento e nos PDFs. Não altera Tomador, Centro de Custo,
 * situação nem os demais dados do cadastro (ver atualizarVinculosEmLote).
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: 'Envie o arquivo no campo "file".' }, { status: 400 });
  const nome = file.name.toLowerCase();
  if (!nome.endsWith(".xls") && !nome.endsWith(".xlsx")) {
    return NextResponse.json({ error: "Formato inválido — envie o arquivo .xls ou .xlsx de Empregados em Excel." }, { status: 400 });
  }

  if (formData.get("modo") === "cadastro") {
    const parsed = await parseCadastrosEmpregadosFile(Buffer.from(await file.arrayBuffer())).catch(() => null);
    if (!parsed) return NextResponse.json({ error: "Não foi possível ler a planilha. Confira se a aba de empregados contém as colunas Cód Epr e Nome." }, { status: 422 });
    if (!parsed.cadastros.length) return NextResponse.json({ error: "Nenhum empregado reconhecido no arquivo." }, { status: 422 });
    try {
      const resultado = await importarColaboradoresEmLote(parsed.cadastros);
      return NextResponse.json({ ...resultado, naPlanilha: parsed.cadastros.length, linhasIgnoradas: parsed.linhasIgnoradas, duplicadas: parsed.duplicadas });
    } catch (error) {
      console.error("[colaboradores/vinculos] falha ao importar cadastros", error instanceof Error ? error.name : "Erro desconhecido");
      return NextResponse.json({ error: "Não foi possível salvar os cadastros." }, { status: 500 });
    }
  }

  let parsed;
  try {
    parsed = await parseEmpregadosFile(Buffer.from(await file.arrayBuffer()));
  } catch (err) {
    return NextResponse.json({ error: `Não foi possível ler o arquivo: ${err instanceof Error ? err.message : "falha ao ler."}` }, { status: 422 });
  }
  if (parsed.vinculos.length === 0) return NextResponse.json({ error: "Nenhum empregado reconhecido no arquivo." }, { status: 422 });

  try {
    const resultado = await atualizarVinculosEmLote(parsed.vinculos);
    return NextResponse.json({
      naPlanilha: parsed.vinculos.length,
      linhasIgnoradas: parsed.linhasIgnoradas,
      duplicadas: parsed.duplicadas,
      ...resultado,
    });
  } catch (err) {
    console.error("[colaboradores/vinculos] erro:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Falha ao salvar." }, { status: 500 });
  }
}
