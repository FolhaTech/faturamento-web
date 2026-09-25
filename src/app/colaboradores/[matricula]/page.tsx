import Link from "next/link";
import { notFound } from "next/navigation";
import { getColaborador } from "@/lib/repo/colaboradores";
import { getDescontoSaldoPorMatriculaECompetencia } from "@/lib/repo/descontosSaldo";
import { listCompetencias } from "@/lib/repo/movimentos";
import { ColaboradorForm } from "../ColaboradorForm";
import { SaldoFeriasCard } from "../SaldoFeriasCard";

export const dynamic = "force-dynamic";

interface SearchParams {
  competencia?: string;
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

      {competencias.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Competência:</span>
          {competencias.map((c) => (
            <Link
              key={c}
              href={`/colaboradores/${matricula}?competencia=${encodeURIComponent(c)}`}
              className={`rounded-full px-3 py-1 text-sm ${
                c === competenciaAtual ? "bg-emerald-700 text-white" : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {c}
            </Link>
          ))}
        </div>
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
