import { NextResponse } from "next/server";
import { aplicarAbatimentoFerias } from "@/lib/calc/abatimentoFerias";
import { getColaboradoresPorMatriculas, upsertColaborador, upsertColaboradoresPendentes } from "@/lib/repo/colaboradores";
import {
  countMovimentos,
  countMovimentosPorCompetencia,
  listCompetencias,
  replaceMovimentosPorCompetencia,
} from "@/lib/repo/movimentos";
import { getTomadorPorNome, upsertTomadoresPendentes } from "@/lib/repo/tomadores";
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

  // O layout "relatório" (ver parseMovimentos.ts) declara a Empresa/Tomador no cabeçalho do
  // arquivo e o Centro de Custo ("Local de trabalho") por colaborador — completa
  // automaticamente quem ainda estiver sem Cód Serviço e/ou sem Centro de Custo com o que o
  // próprio arquivo já traz, em vez de deixar "Cadastro pendente" esperando alguém preencher
  // manualmente uma informação que já veio no upload. Nunca sobrescreve um cadastro já
  // preenchido (só completa o que estiver vazio). O Tomador só é vinculado quando o nome bate
  // com exatamente um cadastrado — nunca escolhe entre nomes duplicados (ver getTomadorPorNome)
  // nem inventa um Tomador novo a partir do código de Empresa do sistema de origem, que usa uma
  // numeração própria e não corresponde ao código do Tomador aqui.
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

  // Quando o arquivo não traz "Local de trabalho" preenchido por colaborador (comum na
  // prática — a coluna existe mas costuma vir vazia), herda o Centro de Custo do colaborador
  // ANTERIOR no arquivo (na ordem em que aparecem nos Movimentos) em vez de olhar o cadastro
  // inteiro do Tomador: um relatório de folha normalmente vem agrupado por local de trabalho, e
  // o colaborador logo acima de quem está sem Ccusto é o sinal mais confiável de com quem ele
  // deve ficar junto na fatura — bem mais preciso que um "Centro de Custo mais comum" que pode
  // vir de outro site do mesmo Tomador. Só propaga um valor que já existe (do próprio cadastro
  // ou de "Local de trabalho"); o primeiro colaborador do arquivo sem nenhum dos dois fica sem
  // herdar nada, não tem de quem puxar.
  const matriculasEmOrdem: number[] = [];
  const matriculasVistas = new Set<number>();
  for (const l of linhas) {
    if (!matriculasVistas.has(l.matricula)) {
      matriculasVistas.add(l.matricula);
      matriculasEmOrdem.push(l.matricula);
    }
  }

  const vinculadosAoArquivo: { matricula: number; nome: string }[] = [];
  const ccustoCompletado: { matricula: number; nome: string; ccusto: string }[] = [];
  let ultimoCcusto: { codigo: string; nome: string } | null = null;
  for (const matricula of matriculasEmOrdem) {
    const c = colaboradoresDoArquivo.get(matricula);
    if (!c) continue;

    const patch: Record<string, string | number> = {};
    if (c.codServico == null && tomadorDoArquivo) {
      patch.cod_servico = tomadorDoArquivo.codigo;
      patch.descricao_servico = tomadorDoArquivo.nome;
    }

    const ccustoVazio = c.dados.cod_ccusto === null || c.dados.cod_ccusto === undefined || String(c.dados.cod_ccusto).trim() === "";
    const localTrabalho = localTrabalhoPorMatricula.get(c.matricula);
    let ccustoResolvido: { codigo: string; nome: string } | null = null;
    if (!ccustoVazio) {
      // já tinha Ccusto próprio — vira a referência pro próximo colaborador sem Ccusto no arquivo.
      ultimoCcusto = { codigo: String(c.dados.cod_ccusto), nome: c.dados.descricao_ccusto ? String(c.dados.descricao_ccusto) : String(c.dados.cod_ccusto) };
    } else if (localTrabalho) {
      ccustoResolvido = { codigo: localTrabalho, nome: localTrabalho };
      ultimoCcusto = ccustoResolvido;
    } else if (ultimoCcusto) {
      ccustoResolvido = ultimoCcusto;
    }
    if (ccustoVazio && ccustoResolvido) {
      patch.cod_ccusto = ccustoResolvido.codigo;
      patch.descricao_ccusto = ccustoResolvido.nome;
    }
    if (Object.keys(patch).length === 0) continue;

    await upsertColaborador({ matricula: c.matricula, dados: { ...c.dados, ...patch } });
    if (patch.cod_servico) vinculadosAoArquivo.push({ matricula: c.matricula, nome: c.nome });
    if (patch.cod_ccusto) ccustoCompletado.push({ matricula: c.matricula, nome: c.nome, ccusto: ccustoResolvido!.nome });
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
