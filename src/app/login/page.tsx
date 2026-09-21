import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth/sessao";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const usuario = await getUsuarioAtual();
  if (usuario) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Faturamento</p>
        <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Entrar</h1>
      </header>

      <LoginForm />

      <p className="text-center text-sm text-neutral-500">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="text-emerald-700 hover:underline">
          Cadastre-se
        </Link>
      </p>
    </main>
  );
}
