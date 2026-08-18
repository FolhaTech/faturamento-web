import Link from "next/link";
import { notFound } from "next/navigation";
import { getColaborador } from "@/lib/repo/colaboradores";
import { ColaboradorForm } from "../ColaboradorForm";

export const dynamic = "force-dynamic";

export default async function EditarColaboradorPage({ params }: { params: Promise<{ matricula: string }> }) {
  const { matricula } = await params;
  const colaborador = getColaborador(Number(matricula));
  if (!colaborador) notFound();

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

      <ColaboradorForm matricula={colaborador.matricula} initialDados={colaborador.dados} />
    </main>
  );
}
