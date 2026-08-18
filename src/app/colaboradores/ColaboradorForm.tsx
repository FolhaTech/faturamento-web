"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SECOES_COLABORADOR } from "@/lib/colaboradorFields";
import type { DadosColaborador } from "@/lib/types";

function buildInitialDados(initial: DadosColaborador): DadosColaborador {
  const dados: DadosColaborador = {};
  for (const secao of SECOES_COLABORADOR) {
    for (const campo of secao.campos) {
      const v = initial[campo.key];
      dados[campo.key] = v === undefined ? "" : v;
    }
  }
  return dados;
}

const SECOES_ABERTAS_POR_PADRAO = new Set(["Identificação", "Vínculo e cargo", "Situação contratual"]);

export function ColaboradorForm({ matricula, initialDados }: { matricula: number | null; initialDados: DadosColaborador }) {
  const router = useRouter();
  const [dados, setDados] = useState<DadosColaborador>(() => buildInitialDados(initialDados));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setField(key: string, value: string) {
    setDados((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setError(null);
    if (!String(dados.nome ?? "").trim()) return setError("Informe o nome.");
    if (!String(dados.cod_epr ?? "").trim()) return setError('Informe "Cód Epr" (matrícula).');

    setBusy(true);
    try {
      const res = await fetch(matricula ? `/api/colaboradores/${matricula}` : "/api/colaboradores", {
        method: matricula ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dados }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha ao salvar.");
        return;
      }
      router.push(`/colaboradores/${data.colaborador.matricula}`);
      router.refresh();
    } catch {
      setError("Falha de rede ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!matricula) return;
    if (!confirm(`Remover o colaborador ${dados.nome}? Essa ação não pode ser desfeita.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/colaboradores/${matricula}`, { method: "DELETE" });
      router.push("/colaboradores");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy ? "Salvando…" : "Salvar"}
        </button>
        {matricula && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Remover
          </button>
        )}
        {error && <div className="text-sm text-red-700">{error}</div>}
      </div>

      {SECOES_COLABORADOR.map((secao) => (
        <details key={secao.secao} open={SECOES_ABERTAS_POR_PADRAO.has(secao.secao)} className="group rounded-lg border border-neutral-200 bg-white">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-neutral-900 marker:text-emerald-700">
            {secao.secao}
            <span className="ml-2 text-xs font-normal text-neutral-400">({secao.campos.length} campos)</span>
          </summary>
          <div className="grid grid-cols-1 gap-3 border-t border-neutral-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {secao.campos.map((campo) => (
              <label key={campo.key} className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
                {campo.label}
                <input
                  type={campo.tipo === "date" ? "date" : campo.tipo === "number" ? "number" : "text"}
                  step={campo.tipo === "number" ? "0.01" : undefined}
                  value={dados[campo.key] ?? ""}
                  disabled={campo.key === "cod_epr" && matricula !== null}
                  onChange={(e) => setField(campo.key, e.target.value)}
                  className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm font-normal text-neutral-900 disabled:bg-neutral-100"
                />
              </label>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
