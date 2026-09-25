import Link from "next/link";
import { CCUSTO_SEM_CADASTRO } from "@/lib/calc/engine";
import { getColaboradoresPorMatriculas } from "@/lib/repo/colaboradores";
import { countMovimentosPorCompetencia, listCompetencias, listMovimentosByCompetencia } from "@/lib/repo/movimentos";
import type { Movimento } from "@/lib/types";
import { CompetenciaSelector, type MesDisponivel } from "./CompetenciaSelector";
import { TomadoresAccordion } from "./TomadoresAccordion";

export const dynamic = "force-dynamic";

const SEM_TOMADOR = "Sem Tomador vinculado";

const TIPO_LABEL: Record<string, string> = { previa: "Prévia", folha: "Folha", normal: "Normal" };

/** "09/2026 (Prévia)" -> { base: "09/2026", tipo: "previa" } — mesmos sufixos de tipoCompetencia.ts. Competência antiga sem sufixo vira tipo "normal". null quando não bate com "MM/AAAA" (linha com erro de leitura antigo, já filtrada antes de chamar isso). */
function parseCompetencia(raw: string): { base: string; tipo: string; mes: number; ano: number } | null {
  let base = raw;
  let tipo = "normal";
  if (raw.endsWith(" (Prévia)")) {
    base = raw.slice(0, -" (Prévia)".length);
    tipo = "previa";
  } else if (raw.endsWith(" (Folha)")) {
    base = raw.slice(0, -" (Folha)".length);
    tipo = "folha";
  }
  const m = base.match(/^(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return { base, tipo, mes: Number(m[1]), ano: Number(m[2]) };
}

interface SearchParams {
  competencia?: string;
}

export default async function MovimentosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  // Competência em branco (upload antigo que caiu num bug de leitura de coluna, já corrigido —
  // ver parseMovimentos.ts) não é uma competência de verdade — mesmo filtro do seletor em
  // faturamento/page.tsx.
  const competencias = (await listCompetencias()).filter((c) => c.trim() !== "");
  const contagens = await countMovimentosPorCompetencia(competencias);

  // Agrupa por Mês/Ano (base) e, dentro dele, por tipo (Prévia/Folha/Normal) — ordenado por data
  // de verdade (ano, mês), não por ordem alfabética da string "MM/AAAA (Tipo)", que embaralha
  // meses de anos diferentes.
  const mesesPorBase = new Map<string, { mes: number; ano: number; tipos: MesDisponivel["tipos"] }>();
  for (const raw of competencias) {
    const parsed = parseCompetencia(raw);
    if (!parsed) continue;
    const entry = mesesPorBase.get(parsed.base) ?? { mes: parsed.mes, ano: parsed.ano, tipos: [] };
    entry.tipos.push({ tipo: parsed.tipo, raw, label: TIPO_LABEL[parsed.tipo] ?? parsed.tipo, qtd: contagens.get(raw) ?? 0 });
    mesesPorBase.set(parsed.base, entry);
  }
  const ORDEM_TIPO = ["previa", "folha", "normal"];
  const meses: MesDisponivel[] = [...mesesPorBase.entries()]
    .sort(([, a], [, b]) => b.ano - a.ano || b.mes - a.mes)
    .map(([base, { mes, ano, tipos }]) => ({
      base,
      label: `${String(mes).padStart(2, "0")}/${ano}`,
      tipos: [...tipos].sort((a, b) => ORDEM_TIPO.indexOf(a.tipo) - ORDEM_TIPO.indexOf(b.tipo)),
    }));

  const competenciaAtual = sp.competencia ?? meses[0]?.tipos[0]?.raw ?? null;

  const lancamentos = competenciaAtual ? await listMovimentosByCompetencia(competenciaAtual) : [];

  // Centro de Custo e Tomador não vêm no lançamento — vêm do cadastro do colaborador, igual ao
  // motor de cálculo (ver getCcusto em engine.ts). Sem cadastro ou sem Ccusto ainda, cai no
  // grupo "Sem centro de custo" (mesmo sentinela usado no Faturamento).
  const matriculas = [...new Set(lancamentos.map((m) => m.matricula))];
  const colaboradoresPorMatricula = await getColaboradoresPorMatriculas(matriculas);

  function ccustoDoLancamento(m: Movimento): { codigo: string; nome: string } {
    const dados = colaboradoresPorMatricula.get(m.matricula)?.dados;
    const codigo = dados?.cod_ccusto;
    if (codigo === null || codigo === undefined || String(codigo).trim() === "") return CCUSTO_SEM_CADASTRO;
    const nome = dados?.descricao_ccusto;
    return { codigo: String(codigo), nome: nome ? String(nome) : String(codigo) };
  }

  // Um Tomador pode ter mais de um Centro de Custo (sites diferentes do mesmo cliente) — agrupa
  // primeiro por Tomador (linha de seleção) e, dentro dele, por Centro de Custo (ver
  // TomadoresAccordion.tsx).
  const porTomador = new Map<string, Map<string, { ccustoNome: string; lancamentos: Movimento[] }>>();
  for (const m of lancamentos) {
    const ccusto = ccustoDoLancamento(m);
    const tomadorNome = colaboradoresPorMatricula.get(m.matricula)?.descricaoServico?.trim() || SEM_TOMADOR;
    const porCcusto = porTomador.get(tomadorNome) ?? new Map<string, { ccustoNome: string; lancamentos: Movimento[] }>();
    const grupoCcusto = porCcusto.get(ccusto.codigo) ?? { ccustoNome: ccusto.nome, lancamentos: [] };
    grupoCcusto.lancamentos.push(m);
    porCcusto.set(ccusto.codigo, grupoCcusto);
    porTomador.set(tomadorNome, porCcusto);
  }
  const gruposPorTomador = [...porTomador.entries()]
    .sort(([a], [b]) => (a === SEM_TOMADOR ? 1 : b === SEM_TOMADOR ? -1 : a.localeCompare(b)))
    .map(([tomadorNome, porCcusto]) => {
      const ccustos = [...porCcusto.entries()]
        .sort(([a, ga], [b, gb]) => (a === CCUSTO_SEM_CADASTRO.codigo ? 1 : b === CCUSTO_SEM_CADASTRO.codigo ? -1 : ga.ccustoNome.localeCompare(gb.ccustoNome)))
        .map(([ccustoCodigo, grupo]) => ({
          ccustoCodigo,
          ccustoNome: grupo.ccustoNome,
          lancamentos: [...grupo.lancamentos].sort((x, y) => x.nome.localeCompare(y.nome) || x.evento.localeCompare(y.evento)),
        }));
      return { tomadorNome, totalLancamentos: ccustos.reduce((n, c) => n + c.lancamentos.length, 0), ccustos };
    });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <header>
        <Link href="/" className="text-sm text-emerald-700 hover:underline">
          ← Voltar
        </Link>
        <p className="mt-3 text-sm font-medium uppercase tracking-wide text-emerald-700">Movimentos</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Lançamentos importados por competência</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Todos os lançamentos já enviados ao sistema, como estão hoje — reenviar o arquivo de uma competência substitui os
          lançamentos dela (ver Faturamento).
        </p>
      </header>

      {competencias.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum arquivo de Movimentos importado ainda.</p>
      ) : (
        <>
          <CompetenciaSelector meses={meses} competenciaAtual={competenciaAtual} />

          {competenciaAtual && (
            <>
              <p className="text-sm text-neutral-600">
                {lancamentos.length} lançamento(s) em {competenciaAtual}, em {gruposPorTomador.length} tomador(es).
              </p>
              <TomadoresAccordion grupos={gruposPorTomador} semTomadorLabel={SEM_TOMADOR} semCcustoCodigo={CCUSTO_SEM_CADASTRO.codigo} />
            </>
          )}
        </>
      )}
    </main>
  );
}
