import Link from "next/link";
import { aggregateByTomador } from "@/lib/calc/aggregate";
import { runEngine } from "@/lib/calc/engine";
import { listCompetencias, listMovimentosByCompetencia } from "@/lib/repo/movimentos";
import { FaturamentoViewer } from "./FaturamentoViewer";
import { UploadMovimentosForm } from "./UploadMovimentosForm";

export const dynamic = "force-dynamic";

export default async function FaturamentoPage({ searchParams }: { searchParams: Promise<{ competencia?: string }> }) {
  const sp = await searchParams;
  const competencias = listCompetencias();
  const competenciaAtual = sp.competencia ?? competencias[0] ?? null;

  let resumos: ReturnType<typeof aggregateByTomador> = [];
  let warnings: string[] = [];
  if (competenciaAtual) {
    const movimentos = listMovimentosByCompetencia(competenciaAtual);
    const engineResult = runEngine(movimentos);
    warnings = engineResult.warnings;
    resumos = aggregateByTomador(engineResult.lines, competenciaAtual);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <header>
        <Link href="/" className="text-sm text-emerald-700 hover:underline">
          ← Voltar
        </Link>
        <p className="mt-3 text-sm font-medium uppercase tracking-wide text-emerald-700">Faturamento</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Cálculo mensal por tomador</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Sobe o arquivo de Movimentos do mês e calcula INSS, FGTS, provisões e faturamento por tomador, usando as
          taxas cadastradas em Encargos e o vínculo de cada colaborador com seu Tomador.
        </p>
      </header>

      <UploadMovimentosForm />

      {competencias.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum arquivo de Movimentos importado ainda.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Competência:</span>
            {competencias.map((c) => (
              <Link
                key={c}
                href={`/faturamento?competencia=${encodeURIComponent(c)}`}
                className={`rounded-full px-3 py-1 text-sm ${
                  c === competenciaAtual ? "bg-emerald-700 text-white" : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {c}
              </Link>
            ))}
          </div>

          <FaturamentoViewer resumos={resumos} warnings={warnings} />
        </>
      )}
    </main>
  );
}
