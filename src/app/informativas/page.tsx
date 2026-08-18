import Link from "next/link";
import { listInformativas } from "@/lib/repo/informativas";
import { InformativasEditor } from "./InformativasEditor";

export const dynamic = "force-dynamic";

export default async function InformativasPage() {
  const informativas = listInformativas();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <header>
        <Link href="/" className="text-sm text-emerald-700 hover:underline">
          ← Voltar
        </Link>
        <p className="mt-3 text-sm font-medium uppercase tracking-wide text-emerald-700">Cadastro</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Informativas</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Benefícios de valor fixo mensal (vale-refeição, vale-transporte, seguro de vida, crachá, ASO etc.). O
          código pode ficar em branco para itens ainda sem evento de folha vinculado.
        </p>
      </header>

      <InformativasEditor initial={informativas} />
    </main>
  );
}
