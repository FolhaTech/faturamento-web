import Link from "next/link";
import { countMovimentosPorCompetencia, listCompetencias, listMovimentosByCompetencia } from "@/lib/repo/movimentos";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function fmt(n: number): string {
  return currency.format(n);
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
  const competenciaAtual = sp.competencia ?? competencias[0] ?? null;
  const contagens = await countMovimentosPorCompetencia(competencias);

  const lancamentos = competenciaAtual ? await listMovimentosByCompetencia(competenciaAtual) : [];
  const ordenados = [...lancamentos].sort((a, b) => a.nome.localeCompare(b.nome) || a.evento.localeCompare(b.evento));

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
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Competência:</span>
            {competencias.map((c) => (
              <Link
                key={c}
                href={`/movimentos?competencia=${encodeURIComponent(c)}`}
                className={`rounded-full px-3 py-1 text-sm ${
                  c === competenciaAtual ? "bg-emerald-700 text-white" : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {c}
                <span className={`ml-1.5 text-[10px] uppercase tracking-wide ${c === competenciaAtual ? "text-emerald-200" : "text-neutral-400"}`}>
                  {contagens.get(c) ?? 0}
                </span>
              </Link>
            ))}
          </div>

          {competenciaAtual && (
            <>
              <p className="text-sm text-neutral-600">
                {ordenados.length} lançamento(s) em {competenciaAtual}.
              </p>
              <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                    <tr>
                      <Th>Matrícula</Th>
                      <Th>Nome</Th>
                      <Th>Código</Th>
                      <Th>Evento</Th>
                      <Th right>Valor</Th>
                      <Th right>Ref</Th>
                      <Th>Tipo</Th>
                      <Th>Forma</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {ordenados.map((m) => (
                      <tr key={m.id} className="hover:bg-neutral-50">
                        <Td mono>{m.matricula}</Td>
                        <Td>{m.nome}</Td>
                        <Td mono>{m.codigo}</Td>
                        <Td>{m.evento}</Td>
                        <Td right mono>
                          {fmt(m.valor)}
                        </Td>
                        <Td right mono>
                          {m.ref}
                        </Td>
                        <Td>{m.tipo}</Td>
                        <Td>{m.forma ?? "—"}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-4 py-2 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, right, mono }: { children: React.ReactNode; right?: boolean; mono?: boolean }) {
  return <td className={`px-4 py-2 ${right ? "text-right" : "text-left"} ${mono ? "font-mono tabular-nums" : ""}`}>{children}</td>;
}
