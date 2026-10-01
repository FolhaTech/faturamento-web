"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export interface ProvisaoColaborador {
  matricula: number;
  /** Já tem desconto de Prov. Férias lançado nessa competência (= "Sim"). */
  aplicadoFerias: boolean;
  aplicado13: boolean;
  /** Acumulado líquido da Rescisão (sem contar o desconto dessa competência) — o que vira desconto quando marcar "Sim". */
  acumuladoFerias: number;
  acumulado13: number;
}

/**
 * Dois seletores Sim/Não no detalhamento do colaborador: Prov. Férias e Prov. 13º. "Sim" lança o
 * Acumulado líquido da Rescisão como desconto desse colaborador nessa competência; "Não" tira esse
 * desconto. Salva na hora ao trocar (ver /api/faturamento/desconto-provisao).
 */
export function DescontoProvisaoColaborador({ matricula, competencia, provisao }: { matricula: number; competencia: string; provisao: ProvisaoColaborador }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function definir(tipo: "ferias" | "13", aplicar: boolean) {
    setErro(null);
    setBusy(true);
    try {
      const res = await fetch("/api/faturamento/desconto-provisao", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matricula, competencia, tipo, aplicar }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErro(data.error ?? "Falha ao salvar.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Falha de rede ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
      <div>
        <h4 className="text-sm font-semibold text-neutral-900">Desconto da provisão acumulada (Rescisão)</h4>
        <p className="text-xs text-neutral-500">
          <strong>Sim</strong> lança o Acumulado líquido como desconto desse colaborador em {competencia}; <strong>Não</strong> tira o desconto. Se a fatura
          dessa competência já foi salva, descarte-a ou salve uma nova versão pra ver a mudança.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Seletor
          rotulo="Prov. Férias"
          valor={provisao.aplicadoFerias}
          acumulado={provisao.acumuladoFerias}
          disabled={busy}
          onChange={(aplicar) => definir("ferias", aplicar)}
        />
        <Seletor
          rotulo="Prov. 13º"
          valor={provisao.aplicado13}
          acumulado={provisao.acumulado13}
          disabled={busy}
          onChange={(aplicar) => definir("13", aplicar)}
        />
      </div>
      {erro && <span className="text-xs text-red-700">{erro}</span>}
    </div>
  );
}

function Seletor({
  rotulo,
  valor,
  acumulado,
  disabled,
  onChange,
}: {
  rotulo: string;
  valor: boolean;
  acumulado: number;
  disabled: boolean;
  onChange: (aplicar: boolean) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
      {rotulo} — Acumulado líquido: <span className="font-mono tabular-nums text-neutral-900">{currency.format(acumulado)}</span>
      <select
        value={valor ? "1" : "0"}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "1")}
        className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm font-normal text-neutral-900 disabled:bg-neutral-100"
      >
        <option value="0">Não</option>
        <option value="1">Sim</option>
      </select>
    </label>
  );
}
