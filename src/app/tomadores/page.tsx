import Link from "next/link";
import { listTomadores } from "@/lib/repo/tomadores";
import { TomadoresEditor } from "./TomadoresEditor";

export const dynamic = "force-dynamic";

export default async function TomadoresPage() {
  const tomadores = await listTomadores();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-12">
      <header>
        <Link href="/" className="text-sm text-emerald-700 hover:underline">
          ← Voltar
        </Link>
        <p className="mt-3 text-sm font-medium uppercase tracking-wide text-emerald-700">Cadastro</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Tomadores</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Clientes que contratam mão de obra. O regime (FPAS) e a taxa administrativa aqui cadastrados são o que
          diferencia o cálculo de encargos de cada cliente.
        </p>
      </header>

      <TomadoresEditor initial={tomadores} />
    </main>
  );
}
