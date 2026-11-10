"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function fmtData(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Aviso de uma competência que perdeu os lançamentos (excluída) mas ainda tem fatura salva no banco: "Restaurar a última versão salva"
 * traz de volta a fatura congelada mais recente como a versão ativa de quem está logado (mesmo caminho do "Usar como minha versão" —
 * POST /api/faturamento/adotar). A tela, o PDF/Word/Excel e a comparação com a Folha voltam a funcionar a partir dela; os lançamentos
 * em si (tabela Movimentos) não voltam — pra isso é preciso reenviar os arquivos. As outras versões seguem na timeline abaixo.
 */
export function RestaurarFaturaSalva({
  competencia,
  versao,
  autor,
  salvoEm,
  qtdVersoes,
}: {
  competencia: string;
  /** Id da versão salva mais recente dessa competência. */
  versao: string;
  autor: string;
  salvoEm: string;
  qtdVersoes: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function restaurar() {
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
        setErro(data.error ?? "Falha ao restaurar.");
        return;
      }
      router.push(`/faturamento?competencia=${encodeURIComponent(competencia)}`);
      router.refresh();
    } catch {
      setErro("Falha de rede ao restaurar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <span>
        <strong>{competencia} não tem mais lançamentos</strong> (foram excluídos), mas há {qtdVersoes === 1 ? "1 fatura salva" : `${qtdVersoes} faturas salvas`} no banco. A mais
        recente é de {autor}, salva em {fmtData(salvoEm)}. Restaurar traz essa fatura de volta como a sua versão: dá pra ver os centros de custo, exportar e comparar com a
        Folha. Os lançamentos em si só voltam reenviando os arquivos de Movimentos. As outras versões estão na timeline abaixo.
      </span>
      <button
        type="button"
        onClick={restaurar}
        disabled={busy}
        className="ml-auto shrink-0 rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
      >
        {busy ? "Restaurando…" : "Restaurar a última versão salva"}
      </button>
      {erro && <p className="w-full text-sm text-red-700">{erro}</p>}
    </div>
  );
}
