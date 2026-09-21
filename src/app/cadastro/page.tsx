import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth/sessao";
import { CadastroForm } from "./CadastroForm";

export const dynamic = "force-dynamic";

export default async function CadastroPage() {
  const usuario = await getUsuarioAtual();
  if (usuario) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Faturamento</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Criar conta</h1>
      </header>

      <CadastroForm />

      <p className="text-center text-sm text-neutral-500">
        Já tem conta?{" "}
        <Link href="/login" className="text-emerald-700 hover:underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
