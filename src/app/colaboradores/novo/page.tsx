import Link from "next/link";
import { ColaboradorForm } from "../ColaboradorForm";

export default function NovoColaboradorPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <header>
        <Link href="/colaboradores" className="text-sm text-emerald-700 hover:underline">
          ← Voltar
        </Link>
        <p className="mt-3 text-sm font-medium uppercase tracking-wide text-emerald-700">Cadastro</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Novo colaborador</h1>
      </header>

      <ColaboradorForm matricula={null} initialDados={{}} />
    </main>
  );
}
