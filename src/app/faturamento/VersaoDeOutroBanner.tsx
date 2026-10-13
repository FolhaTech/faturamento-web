"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function fmtData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Aviso de que a tela está mostrando uma fatura salva por OUTRA pessoa (aberta pelo "Ver esta versão" da timeline): é só pra
 * ver — não muda a versão de ninguém — e os PDF/Word/Excel exportados daqui saem dessa mesma versão. "Usar como minha versão"
 * copia esses números como a versão ativa de quem está logado; "Voltar" volta pra versão do próprio usuário (ou o cálculo ao vivo).
 */
export function VersaoDeOutroBanner({
  competencia,
  versao,
  autor,
  eMinha,
  salvoEm,
}: {
  competencia: string;
  versao: string;
  autor: string;
  /** true = a versão aberta é uma entrada antiga do próprio usuário (não de outra pessoa). */
  eMinha: boolean;
  salvoEm: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function adotar() {
    setErro(null);
    setBusy(true);
    try {
      const res = await fetch("/api/faturamento/adotar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competencia, versao }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error ?? "Falha ao salvar.");
        return;
      }
      router.push(`/faturamento?competencia=${encodeURIComponent(competencia)}`);
      router.refresh();
    } catch {
      setErro("Falha de rede ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-300 bg-sky-50 px-4 py-2.5 text-sm text-sky-900">
      <span>
        <strong>Você está vendo a fatura {eMinha ? "salva por você" : `salva por ${autor}`}</strong> em {fmtData(salvoEm)} — somente leitura. Nada muda na versão de
        ninguém, e o PDF, o Word e o Excel exportados daqui saem desta mesma versão.
      </span>
      <div className="ml-auto flex gap-2">
        <button
          type="button"
          onClick={adotar}
          disabled={busy}
          className="rounded-md bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
        >
          {busy ? "Salvando…" : "Usar como minha versão"}
        </button>
        <Link
          href={`/faturamento?competencia=${encodeURIComponent(competencia)}`}
          className="rounded-md border border-sky-300 bg-white px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-100"
        >
          Voltar para a minha versão
        </Link>
      </div>
      {erro && <p className="w-full text-sm text-red-700">{erro}</p>}
    </div>
  );
}
