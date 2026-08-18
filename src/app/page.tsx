import Link from "next/link";
import { countColaboradores } from "@/lib/repo/colaboradores";
import { countEncargos } from "@/lib/repo/encargos";
import { countInformativas } from "@/lib/repo/informativas";
import { countMovimentos, listCompetencias } from "@/lib/repo/movimentos";
import { countTomadores } from "@/lib/repo/tomadores";
import { ImportForm } from "./ImportForm";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [competencias, totalMovimentos, qtdColaboradores, qtdEncargos, qtdInformativas, qtdTomadores] = await Promise.all([
    listCompetencias(),
    countMovimentos(),
    countColaboradores(),
    countEncargos(),
    countInformativas(),
    countTomadores(),
  ]);

  const cards = [
    {
      href: "/colaboradores",
      title: "Colaboradores",
      count: qtdColaboradores,
      desc: "Cadastro completo — dados pessoais, cargo, documentos, endereço, dependentes.",
    },
    {
      href: "/encargos",
      title: "Encargos",
      count: qtdEncargos,
      desc: "Alíquotas de INSS, FGTS e provisões por código de evento de folha.",
    },
    {
      href: "/informativas",
      title: "Informativas",
      count: qtdInformativas,
      desc: "Benefícios de valor fixo mensal (vale-refeição, seguro de vida, crachá etc.).",
    },
    {
      href: "/tomadores",
      title: "Tomadores",
      count: qtdTomadores,
      desc: "Clientes: regime FPAS e taxa administrativa.",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Cadastros</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Colaboradores, Encargos, Informativas e Tomadores</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Cadastro editável dos 4 conjuntos de dados. Importe uma planilha para popular rapidamente, ou cadastre e
          edite tudo diretamente aqui.
        </p>
      </header>

      <Link
        href="/faturamento"
        className="flex items-center justify-between gap-4 rounded-lg border border-emerald-200 bg-emerald-50 p-5 hover:border-emerald-400 hover:shadow-sm"
      >
        <div>
          <h2 className="text-lg font-semibold text-emerald-900">Faturamento</h2>
          <p className="mt-1 text-sm text-emerald-800">
            {totalMovimentos > 0
              ? `${totalMovimentos} lançamento(s) importado(s) — competências: ${competencias.join(", ")}.`
              : "Suba o arquivo de Movimentos do mês e veja o cálculo por tomador e por colaborador."}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white">Calcular →</span>
      </Link>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-5 hover:border-emerald-300 hover:shadow-sm"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-neutral-900">{c.title}</h2>
              <span className="font-mono text-2xl font-bold tabular-nums text-emerald-700">{c.count}</span>
            </div>
            <p className="text-sm text-neutral-600">{c.desc}</p>
          </Link>
        ))}
      </div>

      <ImportForm />
    </main>
  );
}
