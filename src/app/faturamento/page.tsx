import Link from "next/link";
import { aggregateByCcusto } from "@/lib/calc/aggregate";
import { runEngine } from "@/lib/calc/engine";
import { filtrarLinesPorColaborador } from "@/lib/calc/filtroColaboradores";
import { listCompetencias, listMovimentosByCompetencia } from "@/lib/repo/movimentos";
import { listValoresDistintosDados } from "@/lib/repo/colaboradores";
import { CHAVE_PLR_CELETISTA, getConfigNumero } from "@/lib/repo/configuracoes";
import { listEncargos } from "@/lib/repo/encargos";
import { FaturamentoViewer } from "./FaturamentoViewer";
import { PlrConfigForm } from "./PlrConfigForm";
import { UploadMovimentosForm } from "./UploadMovimentosForm";

export const dynamic = "force-dynamic";

interface SearchParams {
  competencia?: string;
  codEmp?: string;
  descricaoCargo?: string;
  descricaoDpto?: string;
  /** FPAS do Tomador — "515" (Terceiro/CLT) ou "655" (Temporário) — ver FiltrosColaborador.fpas. */
  regime?: string;
}

export default async function FaturamentoPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const competencias = await listCompetencias();
  const competenciaAtual = sp.competencia ?? competencias[0] ?? null;
  const codEmp = sp.codEmp ?? "";
  const descricaoCargo = sp.descricaoCargo ?? "";
  const descricaoDpto = sp.descricaoDpto ?? "";
  const regime = sp.regime === "515" || sp.regime === "655" ? sp.regime : "";
  const fpas = regime ? (Number(regime) as 515 | 655) : undefined;
  const filtrosAtivos = Boolean(codEmp || descricaoCargo || descricaoDpto || regime);

  const [codEmps, descricoesCargo, descricoesDpto, plrCeletista, encargos] = await Promise.all([
    listValoresDistintosDados("cod_emp"),
    listValoresDistintosDados("descricao_cargo"),
    listValoresDistintosDados("descricao_dpto"),
    getConfigNumero(CHAVE_PLR_CELETISTA, 29.32),
    listEncargos(),
  ]);

  let resumos: ReturnType<typeof aggregateByCcusto> = [];
  let warnings: string[] = [];
  if (competenciaAtual) {
    const movimentos = await listMovimentosByCompetencia(competenciaAtual);
    const engineResult = await runEngine(movimentos);
    warnings = engineResult.warnings;

    const lines = await filtrarLinesPorColaborador(engineResult.lines, { codEmp, descricaoCargo, descricaoDpto, fpas });
    resumos = aggregateByCcusto(lines, competenciaAtual);
  }

  const filtrosQuery = new URLSearchParams();
  if (codEmp) filtrosQuery.set("codEmp", codEmp);
  if (descricaoCargo) filtrosQuery.set("descricaoCargo", descricaoCargo);
  if (descricaoDpto) filtrosQuery.set("descricaoDpto", descricaoDpto);
  if (regime) filtrosQuery.set("regime", regime);

  function filterHref(overrides: Partial<SearchParams>): string {
    const params = new URLSearchParams();
    const merged = { competencia: competenciaAtual ?? undefined, codEmp, descricaoCargo, descricaoDpto, regime, ...overrides };
    if (merged.competencia) params.set("competencia", merged.competencia);
    if (merged.codEmp) params.set("codEmp", merged.codEmp);
    if (merged.descricaoCargo) params.set("descricaoCargo", merged.descricaoCargo);
    if (merged.descricaoDpto) params.set("descricaoDpto", merged.descricaoDpto);
    if (merged.regime) params.set("regime", merged.regime);
    return `/faturamento?${params.toString()}`;
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <header>
        <Link href="/" className="text-sm text-emerald-700 hover:underline">
          ← Voltar
        </Link>
        <p className="mt-3 text-sm font-medium uppercase tracking-wide text-emerald-700">Faturamento</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Cálculo mensal por centro de custo</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Sobe o arquivo de Movimentos do mês e calcula INSS, FGTS, provisões e faturamento por centro de custo
          (Ccusto), usando FPAS e taxa administrativa do Tomador de cada colaborador e as taxas cadastradas em
          Encargos.
        </p>
      </header>

      <UploadMovimentosForm />

      <PlrConfigForm valorInicial={plrCeletista} />

      {competencias.length === 0 ? (
        <p className="text-sm text-neutral-500">Nenhum arquivo de Movimentos importado ainda.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Competência:</span>
            {competencias.map((c) => (
              <Link
                key={c}
                href={filterHref({ competencia: c })}
                className={`rounded-full px-3 py-1 text-sm ${
                  c === competenciaAtual ? "bg-emerald-700 text-white" : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {c}
              </Link>
            ))}
          </div>

          <form method="GET" className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4">
            {competenciaAtual && <input type="hidden" name="competencia" value={competenciaAtual} />}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-500">Cód Emp</label>
              <select name="codEmp" defaultValue={codEmp} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">
                <option value="">Todos</option>
                {codEmps.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-500">Descrição cargo</label>
              <select
                name="descricaoCargo"
                defaultValue={descricaoCargo}
                className="min-w-48 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
              >
                <option value="">Todos</option>
                {descricoesCargo.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-500">Descrição Dpto</label>
              <select
                name="descricaoDpto"
                defaultValue={descricaoDpto}
                className="min-w-48 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
              >
                <option value="">Todos</option>
                {descricoesDpto.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-neutral-500">Regime</label>
              <select name="regime" defaultValue={regime} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">
                <option value="">Todos</option>
                <option value="515">515 — Terceiro (CLT)</option>
                <option value="655">655 — Temporário</option>
              </select>
            </div>
            <button type="submit" className="rounded-md border border-neutral-300 bg-white px-4 py-1.5 text-sm font-medium hover:bg-neutral-50">
              Filtrar
            </button>
            {filtrosAtivos && (
              <Link
                href={filterHref({ codEmp: undefined, descricaoCargo: undefined, descricaoDpto: undefined, regime: undefined })}
                className="text-sm text-neutral-500 hover:underline"
              >
                limpar
              </Link>
            )}
          </form>
          {filtrosAtivos && (
            <p className="-mt-3 px-1 text-xs text-neutral-500">
              Faturamento recalculado só com os colaboradores que atendem aos filtros acima — os totais por centro de custo refletem essa seleção, não a folha inteira.
            </p>
          )}

          <FaturamentoViewer
            resumos={resumos}
            warnings={warnings}
            filtrosQuery={filtrosQuery.toString()}
            regimeLabel={fpas === 515 ? "Terceiro (CLT)" : fpas === 655 ? "Temporário" : null}
            encargos={encargos}
          />
        </>
      )}
    </main>
  );
}
