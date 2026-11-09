"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Junta vários centros de custo num só, no Faturamento: marque os centros que devem virar um e digite o nome do final (ex.: "CHAMA
 * LOGISTICO - FOLHA 1026" + "CHAMA LOGISTICO - ADIANTAMENTO 102026" -> "CHAMA LOGISTICO"). Todo colaborador deles passa pro centro de custo
 * final, em qualquer competência (ver /api/faturamento/unificar-centros-de-custo). O Tomador de cada colaborador não muda.
 */
export function UnificarCentrosDeCusto({
  centros,
  onUnificado,
}: {
  centros: { codigo: string; nome: string; qtdColaboradores: number }[];
  /** Chamado com o código do centro de custo final depois de unificar — a tela passa a mostrar esse centro. */
  onUnificado: (codigoDestino: string) => void;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  function alternar(codigo: string) {
    setEscolhidos((atual) => (atual.includes(codigo) ? atual.filter((c) => c !== codigo) : [...atual, codigo]));
  }

  async function unificar() {
    const nomeFinal = nome.trim().replace(/\s+/g, " ");
    if (escolhidos.length < 1 || nomeFinal === "") return;
    const nomes = centros.filter((c) => escolhidos.includes(c.codigo)).map((c) => `• ${c.nome} (${c.qtdColaboradores} colab.)`);
    const aviso = `Unificar em "${nomeFinal.toUpperCase()}":\n\n${nomes.join("\n")}\n\nTodos os colaboradores desses centros de custo passam a ser do centro "${nomeFinal.toUpperCase()}", em qualquer competência.\nSe a fatura dessa competência já foi salva, salve de novo pra ver a mudança.`;
    if (!window.confirm(aviso)) return;

    setErro(null);
    setResultado(null);
    setBusy(true);
    try {
      const res = await fetch("/api/faturamento/unificar-centros-de-custo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigos: escolhidos, nome: nomeFinal }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(data.error ?? "Falha ao unificar.");
        return;
      }
      setResultado(`${data.atualizados} colaborador(es) agora estão em "${data.destino?.nome ?? nomeFinal}". Se a fatura desta competência está salva, salve de novo.`);
      setEscolhidos([]);
      setNome("");
      if (data.destino?.codigo) onUnificado(String(data.destino.codigo));
      router.refresh();
    } catch {
      setErro("Falha de rede ao unificar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <button type="button" onClick={() => setAberto((v) => !v)} className="flex w-full items-center justify-between text-left text-sm font-medium text-neutral-700">
        <span>Unificar centros de custo</span>
        <span className="text-neutral-400">{aberto ? "▲" : "▼"}</span>
      </button>
      {resultado && <p className="mt-2 text-xs text-emerald-800">{resultado}</p>}
      {aberto && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-xs text-neutral-500">
            Marque os centros de custo que devem virar um só e digite o nome do centro final. Todos os colaboradores deles passam a ser do centro final (em qualquer
            competência); o Tomador de cada um não muda. Se já existe um centro com esse nome, os colaboradores vão pra ele.
          </p>
          <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border border-neutral-200 p-2">
            {centros.map((c) => (
              <li key={c.codigo}>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-800">
                  <input type="checkbox" checked={escolhidos.includes(c.codigo)} disabled={busy} onChange={() => alternar(c.codigo)} className="h-4 w-4" />
                  <span>
                    {c.nome} <span className="text-neutral-400">({c.qtdColaboradores} colab.)</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
              Nome do centro de custo final
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={busy}
                placeholder="Ex.: CHAMA LOGISTICO"
                maxLength={100}
                className="min-w-72 rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-normal text-neutral-900"
              />
            </label>
            <button
              type="button"
              onClick={unificar}
              disabled={busy || escolhidos.length < 1 || nome.trim() === ""}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {busy ? "Unificando…" : `Unificar ${escolhidos.length > 0 ? `${escolhidos.length} centro(s)` : ""}`.trim()}
            </button>
          </div>
          {erro && <span className="text-xs text-red-700">{erro}</span>}
        </div>
      )}
    </div>
  );
}
