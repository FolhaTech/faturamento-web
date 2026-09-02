import { NextResponse } from "next/server";
import { aplicarAbatimentoFerias } from "@/lib/calc/abatimentoFerias";
import {
  getColaboradoresPorMatriculas,
  getTomadoresPorCcusto,
  upsertColaborador,
  upsertColaboradoresPendentes,
} from "@/lib/repo/colaboradores";
import {
  countMovimentos,
  countMovimentosPorCompetencia,
  listCompetencias,
  replaceMovimentosPorCompetencia,
} from "@/lib/repo/movimentos";
import { getTomadorPorNome, listTomadores, upsertTomadoresPendentes } from "@/lib/repo/tomadores";
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

  let linhas, tomadorNomeArquivo, localTrabalhoPorMatricula;
  try {
    ({ linhas, tomadorNomeArquivo, localTrabalhoPorMatricula } = await parseMovimentosFile(buffer));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao ler o arquivo.";
    return NextResponse.json({ error: `Não foi possível ler o arquivo: ${message}` }, { status: 422 });
  }

  if (linhas.length === 0) {
    return NextResponse.json({ error: "Nenhum lançamento reconhecido no arquivo." }, { status: 422 });
  }

  const competencias = [...new Set(linhas.map((l) => l.competencia))];

  // Subir um arquivo para uma competência que já tem lançamentos salvos SUBSTITUI esses lançamentos
  // (ver replaceMovimentosPorCompetencia) — avisa e pede confirmação explícita antes de apagar dados
  // existentes, em vez de substituir silenciosamente.
  const confirmar = formData.get("confirmar") === "true";
  if (!confirmar) {
    const existentesPorCompetencia = await countMovimentosPorCompetencia(competencias);
    const competenciasComDados = competencias
      .filter((c) => (existentesPorCompetencia.get(c) ?? 0) > 0)
      .map((c) => ({ competencia: c, existentes: existentesPorCompetencia.get(c) ?? 0 }));
    if (competenciasComDados.length > 0) {
      return NextResponse.json({ requerConfirmacao: true, competencias: competenciasComDados, novosLancamentos: linhas.length }, { status: 409 });
    }
  }

  // Matrícula do arquivo sem cadastro em Colaboradores: cria um cadastro mínimo (sem Tomador) em vez de só
  // descartar o lançamento — fica visível pra completar, e assim que tiver Cód Serviço entra no faturamento.
  const cadastrosNovos = await upsertColaboradoresPendentes(linhas.map((l) => ({ matricula: l.matricula, nome: l.nome })));

  const matriculasDoArquivo = [...new Set(linhas.map((l) => l.matricula))];
  let colaboradoresDoArquivo = await getColaboradoresPorMatriculas(matriculasDoArquivo);

  // O layout "relatório" (ver parseMovimentos.ts) declara a Empresa no cabeçalho do arquivo e o
  // Centro de Custo ("Local de trabalho") por colaborador. O cabeçalho "Empresa:" só serve de
  // ÚLTIMO recurso pro Tomador: pode ser só a prestadora que administra a folha (ex.: uma
  // agência de RH terceirizando pra vários clientes finais), não quem paga a fatura — ver
  // getTomadoresPorCcusto mais abaixo, que é o sinal preferido.
  let tomadorDoArquivo = null;
  let avisoTomadorArquivo: string | null = null;
  if (tomadorNomeArquivo) {
    const { tomador, ambiguo } = await getTomadorPorNome(tomadorNomeArquivo);
    if (tomador) {
      tomadorDoArquivo = tomador;
    } else {
      avisoTomadorArquivo = ambiguo
        ? `O arquivo indica a Empresa "${tomadorNomeArquivo}", mas há mais de um Tomador cadastrado com esse nome — vínculo automático não realizado, complete o Cód Serviço manualmente.`
        : `O arquivo indica a Empresa "${tomadorNomeArquivo}", mas não encontrei nenhum Tomador cadastrado com esse nome — vínculo automático não realizado.`;
    }
  }

  const matriculasEmOrdem: number[] = [];
  const matriculasVistas = new Set<number>();
  for (const l of linhas) {
    if (!matriculasVistas.has(l.matricula)) {
      matriculasVistas.add(l.matricula);
      matriculasEmOrdem.push(l.matricula);
    }
  }

  // 1ª passada: resolve o Centro de Custo de cada colaborador do arquivo (na ordem em que
  // aparecem nos Movimentos), sem gravar nada ainda. Quando o arquivo não traz "Local de
  // trabalho" preenchido por colaborador (comum na prática — a coluna existe mas costuma vir
  // vazia), herda do colaborador ANTERIOR no arquivo: um relatório de folha normalmente vem
  // agrupado por local de trabalho, e quem está logo acima de um colaborador sem Ccusto é o
  // sinal mais confiável de com quem ele deve ficar junto. Só propaga um valor que já existe
  // (do próprio cadastro ou de "Local de trabalho"); o primeiro colaborador do arquivo sem
  // nenhum dos dois fica sem herdar nada.
  const ccustoPorMatricula = new Map<number, { codigo: string; nome: string }>();
  let ultimoCcusto: { codigo: string; nome: string } | null = null;
  for (const matricula of matriculasEmOrdem) {
    const c = colaboradoresDoArquivo.get(matricula);
    if (!c) continue;
    const ccustoVazio = c.dados.cod_ccusto === null || c.dados.cod_ccusto === undefined || String(c.dados.cod_ccusto).trim() === "";
    const localTrabalho = localTrabalhoPorMatricula.get(matricula);
    let ccusto: { codigo: string; nome: string } | null = null;
    if (!ccustoVazio) {
      ccusto = { codigo: String(c.dados.cod_ccusto), nome: c.dados.descricao_ccusto ? String(c.dados.descricao_ccusto) : String(c.dados.cod_ccusto) };
    } else if (localTrabalho) {
      ccusto = { codigo: localTrabalho, nome: localTrabalho };
    } else if (ultimoCcusto) {
      ccusto = ultimoCcusto;
    }
    if (ccusto) {
      ccustoPorMatricula.set(matricula, ccusto);
      ultimoCcusto = ccusto;
    }
  }

  // Descobre, pra cada Centro de Custo envolvido, qual Tomador os colaboradores JÁ CADASTRADOS
  // nesse mesmo Centro de Custo usam — sinal preferido sobre o cabeçalho "Empresa:" do arquivo
  // (ver getTomadoresPorCcusto). Um Centro de Custo ambíguo (mais de um Tomador) ou sem
  // histórico nenhum cai de volta pro cabeçalho "Empresa:".
  const tomadorPorCcusto = await getTomadoresPorCcusto([...ccustoPorMatricula.values()].map((c) => c.nome));
  const tomadoresPorCodigo = new Map((await listTomadores()).map((t) => [t.codigo, t]));

  // 2ª passada: aplica os dois vínculos — Cód Serviço (Tomador) e Centro de Custo — em quem
  // ainda estiver vazio. Nunca sobrescreve um cadastro já preenchido.
  const vinculadosAoArquivo: { matricula: number; nome: string }[] = [];
  const ccustoCompletado: { matricula: number; nome: string; ccusto: string }[] = [];
  for (const matricula of matriculasEmOrdem) {
    const c = colaboradoresDoArquivo.get(matricula);
    if (!c) continue;

    const patch: Record<string, string | number> = {};
    if (c.codServico == null) {
      const ccusto = ccustoPorMatricula.get(matricula);
      const porCcusto = ccusto ? tomadorPorCcusto.get(ccusto.nome) : undefined;
      const tomadorResolvido =
        porCcusto && !porCcusto.ambiguo ? (tomadoresPorCodigo.get(porCcusto.codigo) ?? null) : tomadorDoArquivo;
      if (tomadorResolvido) {
        patch.cod_servico = tomadorResolvido.codigo;
        patch.descricao_servico = tomadorResolvido.nome;
      }
    }

    const ccustoVazio = c.dados.cod_ccusto === null || c.dados.cod_ccusto === undefined || String(c.dados.cod_ccusto).trim() === "";
    if (ccustoVazio) {
      const ccustoResolvido = ccustoPorMatricula.get(matricula);
      if (ccustoResolvido) {
        patch.cod_ccusto = ccustoResolvido.codigo;
        patch.descricao_ccusto = ccustoResolvido.nome;
      }
    }
    if (Object.keys(patch).length === 0) continue;

    await upsertColaborador({ matricula: c.matricula, dados: { ...c.dados, ...patch } });
    if (patch.cod_servico) vinculadosAoArquivo.push({ matricula: c.matricula, nome: c.nome });
    if (patch.cod_ccusto) ccustoCompletado.push({ matricula: c.matricula, nome: c.nome, ccusto: String(patch.descricao_ccusto) });
  }
  if (vinculadosAoArquivo.length > 0 || ccustoCompletado.length > 0) {
    colaboradoresDoArquivo = await getColaboradoresPorMatriculas(matriculasDoArquivo);
  }

  // Colaborador (novo ou já cadastrado) com Cód Serviço apontando pra um Tomador que ainda não
  // existe: mesma lógica de cadastrosNovos, mas pro lado do Tomador — cria um cadastro mínimo em
  // vez de só descartar o faturamento desse colaborador com aviso.
  const tomadoresNovos = await upsertTomadoresPendentes(
    [...colaboradoresDoArquivo.values()]
      .filter((c) => c.codServico != null)
      .map((c) => ({ codigo: c.codServico!, nomeSugerido: c.descricaoServico })),
  );

  // Precisa rodar ANTES de substituir os lançamentos: devolve ao saldo o que um upload anterior
  // dessa(s) competência(s) já tinha abatido, antes de calcular o abatimento em cima do arquivo novo.
  const linhasComAbatimento = await aplicarAbatimentoFerias(linhas);

  await replaceMovimentosPorCompetencia(linhasComAbatimento);

  return NextResponse.json({
    importados: linhas.length,
    competencias,
    // Só quem ainda ficou sem Cód Serviço depois do vínculo automático acima precisa de atenção manual.
    cadastrosNovos: cadastrosNovos
      .filter((c) => colaboradoresDoArquivo.get(c.matricula)?.codServico == null)
      .map((c) => ({ matricula: c.matricula, nome: c.nome })),
    vinculadosAoArquivo,
    avisoTomadorArquivo,
    ccustoCompletado,
    tomadoresNovos: tomadoresNovos.map((t) => ({ codigo: t.codigo, nome: t.nome })),
  });
}
