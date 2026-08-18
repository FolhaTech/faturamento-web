import Link from "next/link";
import { listEncargos } from "@/lib/repo/encargos";
import { EncargosEditor } from "./EncargosEditor";

export const dynamic = "force-dynamic";

export default async function EncargosPage() {
  const encargos = await listEncargos();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-12">
      <header>
        <Link href="/" className="text-sm text-emerald-700 hover:underline">
          ← Voltar
        </Link>
        <p className="mt-3 text-sm font-medium uppercase tracking-wide text-emerald-700">Cadastro</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Encargos</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Alíquotas de INSS (515/655), FGTS e provisões de férias/13º por código de evento de folha. O Tipo define
          como o valor é tratado: P (provento), D (desconto), I (informativo/benefício), R (reembolso), FGTS ou INSS
          (linhas já calculadas).
        </p>
      </header>

      <EncargosEditor initial={encargos} />
    </main>
  );
}
