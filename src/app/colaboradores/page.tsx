import Link from "next/link";
import { listColaboradores, listSituacoes, listValoresDistintosDados } from "@/lib/repo/colaboradores";
import { listTomadores } from "@/lib/repo/tomadores";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

interface SearchParams {
  busca?: string;
  situacao?: string;
  codEmp?: string;
  descricaoCargo?: string;
  codServico?: string;
  descricaoDpto?: string;
  page?: string;
}

export default async function ColaboradoresPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const busca = sp.busca ?? "";
  const situacao = sp.situacao ?? "";
  const codEmp = sp.codEmp ?? "";
  const descricaoCargo = sp.descricaoCargo ?? "";
  const codServicoStr = sp.codServico ?? "";
  const codServico = codServicoStr ? Number(codServicoStr) : undefined;
  const descricaoDpto = sp.descricaoDpto ?? "";
  const page = Number(sp.page ?? "1") || 1;
  const pageSize = 25;

  const [{ items, total }, situacoes, codEmps, descricoesCargo, tomadores, descricoesDpto] = await Promise.all([
    listColaboradores({ busca, situacao, codEmp, descricaoCargo, codServico, descricaoDpto, page, pageSize }),
    listSituacoes(),
    listValoresDistintosDados("cod_emp"),
    listValoresDistintosDados("descricao_cargo"),
    listTomadores(),
    listValoresDistintosDados("descricao_dpto"),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const filtrosAtivos = busca || situacao || codEmp || descricaoCargo || codServicoStr || descricaoDpto;

  // Mesmo nome pode aparecer em mais de um Tomador (ex.: 2 contratos "ITAU UNIBANCO S.A" com FPAS diferentes) —
  // mostra o código junto no rótulo só quando o nome se repete, pra não desambiguar à toa.
  const contagemPorNome = new Map<string, number>();
  for (const t of tomadores) contagemPorNome.set(t.nome, (contagemPorNome.get(t.nome) ?? 0) + 1);
  function labelTomador(t: { codigo: number; nome: string }): string {
    return (contagemPorNome.get(t.nome) ?? 0) > 1 ? `${t.nome} (cód. ${t.codigo})` : t.nome;
  }

  function pageHref(p: number): string {
    const params = new URLSearchParams();
    if (busca) params.set("busca", busca);
    if (situacao) params.set("situacao", situacao);
    if (codEmp) params.set("codEmp", codEmp);
    if (descricaoCargo) params.set("descricaoCargo", descricaoCargo);
    if (codServicoStr) params.set("codServico", codServicoStr);
    if (descricaoDpto) params.set("descricaoDpto", descricaoDpto);
    params.set("page", String(p));
    return `/colaboradores?${params.toString()}`;
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link href="/" className="text-sm text-emerald-700 hover:underline">
            ← Voltar
          </Link>
          <p className="mt-3 text-sm font-medium uppercase tracking-wide text-emerald-700">Cadastro</p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Colaboradores</h1>
          <p className="mt-2 text-sm text-neutral-600">{total} colaborador(es) cadastrados.</p>
        </div>
        <Link
          href="/colaboradores/novo"
          className="shrink-0 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          + Novo colaborador
        </Link>
      </header>

      <form method="GET" className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-500">Busca (nome ou matrícula)</label>
          <input
            name="busca"
            defaultValue={busca}
            placeholder="ex.: Ricardo, 90103478…"
            className="w-64 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-500">Situação</label>
          <select name="situacao" defaultValue={situacao} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">
            <option value="">Todas</option>
            {situacoes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
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
          <select name="descricaoCargo" defaultValue={descricaoCargo} className="min-w-48 rounded-md border border-neutral-300 px-3 py-1.5 text-sm">
            <option value="">Todos</option>
            {descricoesCargo.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-500">Descrição Serviço (Tomador)</label>
          <select
            name="codServico"
            defaultValue={codServicoStr}
            className="min-w-56 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            {tomadores.map((t) => (
              <option key={t.codigo} value={t.codigo}>
                {labelTomador(t)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-500">Descrição Dpto</label>
          <select name="descricaoDpto" defaultValue={descricaoDpto} className="min-w-48 rounded-md border border-neutral-300 px-3 py-1.5 text-sm">
            <option value="">Todos</option>
            {descricoesDpto.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-md border border-neutral-300 bg-white px-4 py-1.5 text-sm font-medium hover:bg-neutral-50">
          Filtrar
        </button>
        {filtrosAtivos && (
          <Link href="/colaboradores" className="text-sm text-neutral-500 hover:underline">
            limpar
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Matrícula</th>
              <th className="px-3 py-2 text-left font-medium">Nome</th>
              <th className="px-3 py-2 text-left font-medium">Situação</th>
              <th className="px-3 py-2 text-left font-medium">Tomador</th>
              <th className="px-3 py-2 text-right font-medium">Salário</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {items.map((c) => (
              <tr key={c.matricula} className="hover:bg-neutral-50">
                <td className="px-3 py-2">
                  <Link href={`/colaboradores/${c.matricula}`} className="font-mono tabular-nums text-emerald-700 hover:underline">
                    {c.matricula}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Link href={`/colaboradores/${c.matricula}`} className="hover:underline">
                    {c.nome}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.situacao === "Trabalhando" ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {c.situacao ?? "—"}
                  </span>
                </td>
                <td className="px-3 py-2 text-neutral-600">
                  {c.descricaoServico ? labelTomador({ codigo: c.codServico ?? 0, nome: c.descricaoServico }) : "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{currency.format(c.salario)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-neutral-500">
                  Nenhum colaborador encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <Link
            href={pageHref(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={`rounded-md border border-neutral-300 px-3 py-1 ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-neutral-50"}`}
          >
            ← anterior
          </Link>
          <span className="text-neutral-500">
            página {page} de {totalPages}
          </span>
          <Link
            href={pageHref(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            className={`rounded-md border border-neutral-300 px-3 py-1 ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-neutral-50"}`}
          >
            próxima →
          </Link>
        </div>
      )}
    </main>
  );
}
