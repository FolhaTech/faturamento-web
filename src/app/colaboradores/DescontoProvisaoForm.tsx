"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DescontoProvisaoForm({
  matricula,
  descontarProvFeriasInicial,
  descontarProv13Inicial,
}: {
  matricula: number;
  descontarProvFeriasInicial: boolean;
  descontarProv13Inicial: boolean;
}) {
  const router = useRouter();
  const [descontarProvFerias, setDescontarProvFerias] = useState(descontarProvFeriasInicial);
  const [descontarProv13, setDescontarProv13] = useState(descontarProv13Inicial);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  async function salvar() {
    setErro(null);
    setSalvo(false);
    setBusy(true);
    try {
      const res = await fetch(`/api/colaboradores/${matricula}/desconto-provisao`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descontarProvFerias, descontarProv13 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Falha ao salvar.");
        return;
      }
      setSalvo(true);
      router.refresh();
    } catch {
      setErro("Falha de rede ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">Desconto automático de provisão na Folha</h2>
      <p className="text-xs text-neutral-500">
        Quando marcado <strong>Sim</strong>, o valor acumulado de Prov. Férias / Prov. 13º da Rescisão será lançado
        como desconto (crédito) na próxima Folha processada para esse colaborador. O desconto é aplicado uma única vez
        por flag; para descontar novamente, marque <strong>Não</strong> e depois <strong>Sim</strong>.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
          Descontar Prov. Férias na Folha
          <select
            value={descontarProvFerias ? "1" : "0"}
            disabled={busy}
            onChange={(e) => setDescontarProvFerias(e.target.value === "1")}
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm font-normal text-neutral-900 disabled:bg-neutral-100"
          >
            <option value="0">Não</option>
            <option value="1">Sim</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
          Descontar Prov. 13º na Folha
          <select
            value={descontarProv13 ? "1" : "0"}
            disabled={busy}
            onChange={(e) => setDescontarProv13(e.target.value === "1")}
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm font-normal text-neutral-900 disabled:bg-neutral-100"
          >
            <option value="0">Não</option>
            <option value="1">Sim</option>
          </select>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={salvar}
          disabled={busy}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy ? "Salvando…" : "Salvar"}
        </button>
        {salvo && <span className="text-xs font-medium text-emerald-700">Salvo.</span>}
        {erro && <span className="text-xs text-red-700">{erro}</span>}
      </div>
    </div>
  );
}
