import Link from "next/link";
import { notFound } from "next/navigation";
import { getColaborador } from "@/lib/repo/colaboradores";
import { CompetenciaCalendario, type MesDisponivel } from "../CompetenciaCalendario";
import { getDescontoSaldoPorMatriculaECompetencia } from "@/lib/repo/descontosSaldo";
import { listCompetencias } from "@/lib/repo/movimentos";
import { ColaboradorForm } from "../ColaboradorForm";
import { SaldoFeriasCard } from "../SaldoFeriasCard";

export const dynamic = "force-dynamic";

interface SearchParams {
  competencia?: string;
}

const ORDEM_TIPO = [" (Folha)", " (Prévia)", ""];

/** Agrupa as competências (que podem ter sufixo de tipo — ver tipoCompetencia.ts) por Mês/Ano, pro calendário navegar por mês sem precisar saber de Prévia/Folha. */
function agruparPorMes(competencias: string[]): MesDisponivel[] {
  const porBase = new Map<string, string[]>();
  for (const c of competencias) {
    const base = c.replace(/\s*\((Prévia|Folha)\)$/, "");
    if (!/^\d{2}\/\d{4}$/.test(base)) continue;
    const arr = porBase.get(base) ?? [];
    arr.push(c);
    porBase.set(base, arr);
  }
  return [...porBase.entries()].map(([base, raws]) => ({
    base,
    raws: [...raws].sort((a, b) => {
      const sufixoA = ORDEM_TIPO.findIndex((s) => a.endsWith(s));
      const sufixoB = ORDEM_TIPO.findIndex((s) => b.endsWith(s));
      return sufixoA - sufixoB;
    }),
  }));
}

export default async function EditarColaboradorPage({
  params,
  searchParams,
}: {
  params: Promise<{ matricula: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { matricula } = await params;
  const sp = await searchParams;
  const colaborador = await getColaborador(Number(matricula));
  if (!colaborador) notFound();

  // Competência em branco (upload antigo que caiu num bug de leitura de coluna, já corrigido —
  // ver parseMovimentos.ts) não é uma competência de verdade — mesmo filtro do seletor em
  // faturamento/page.tsx.
  const competencias = (await listCompetencias()).filter((c) => c.trim() !== "");
  const meses = agruparPorMes(competencias);
  const competenciaAtual = sp.competencia ?? competencias[0] ?? null;
  // Desconto de saldo (férias/13° salário) já lançado NESSA competência específica — cada mês
  // mostra o próprio valor, sem se misturar com os outros (ver descontosSaldo.ts).
  const descontoNaCompetencia = competenciaAtual
    ? await getDescontoSaldoPorMatriculaECompetencia(colaborador.matricula, competenciaAtual)
    : { ferias: 0, terco: 0 };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <header>
        <Link href="/colaboradores" className="text-sm text-emerald-700 hover:underline">
          ← Voltar
        </Link>
        <p className="mt-3 text-sm font-medium uppercase tracking-wide text-emerald-700">Cadastro</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">{colaborador.nome}</h1>
        <p className="mt-1 text-sm text-neutral-600">Matrícula {colaborador.matricula}</p>
      </header>

      {meses.length > 0 && (
        <CompetenciaCalendario meses={meses} competenciaAtual={competenciaAtual} basePath={`/colaboradores/${matricula}`} />
      )}

      <SaldoFeriasCard
        matricula={colaborador.matricula}
        saldoFeriasInicial={colaborador.saldoFerias}
        saldoUmTercoInicial={colaborador.saldoUmTerco}
        competenciaAtual={competenciaAtual}
        descontoFeriasNaCompetencia={descontoNaCompetencia.ferias}
        descontoUmTercoNaCompetencia={descontoNaCompetencia.terco}
      />
      <ColaboradorForm matricula={colaborador.matricula} initialDados={colaborador.dados} />
    </main>
  );
}
