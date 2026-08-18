import { NextResponse } from "next/server";
import { importReferenceBase } from "@/lib/importXlsx";

export const runtime = "nodejs";

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

  try {
    const result = await importReferenceBase(buffer);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao importar o arquivo.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
