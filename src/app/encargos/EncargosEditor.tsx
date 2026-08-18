"use client";

import { useMemo, useState } from "react";
import type { Encargo, TipoEvento } from "@/lib/types";

const TIPOS: TipoEvento[] = ["P", "D", "I", "R", "FGTS", "INSS"];

interface FormState {
  codigo: string;
  evento: string;
  tipo: TipoEvento;
  inss655: string;
  inss515: string;
  fgts: string;
  provFerias: string;
  prov13: string;
}

const EMPTY: FormState = { codigo: "", evento: "", tipo: "P", inss655: "", inss515: "", fgts: "", provFerias: "", prov13: "" };

function toForm(e: Encargo): FormState {
  return {
    codigo: String(e.codigo),
    evento: e.evento,
    tipo: e.tipo,
    inss655: String(e.inss655 * 100),
    inss515: String(e.inss515 * 100),
    fgts: String(e.fgts * 100),
    provFerias: String(e.provFerias * 100),
    prov13: String(e.prov13 * 100),
  };
}

function pct(v: string): number {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n / 100 : 0;
}

export function EncargosEditor({ initial }: { initial: Encargo[] }) {
  const [items, setItems] = useState(initial);
  const [busca, setBusca] = useState("");
  const [editingCodigo, setEditingCodigo] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return items;
    return items.filter((e) => e.evento.toLowerCase().includes(q) || String(e.codigo).includes(q));
  }, [items, busca]);

  function startEdit(e: Encargo) {
    setEditingCodigo(e.codigo);
    setCreating(false);
    setForm(toForm(e));
  }

  function startCreate() {
    setCreating(true);
    setEditingCodigo(null);
    setForm(EMPTY);
  }

  function cancel() {
    setEditingCodigo(null);
    setCreating(false);
    setError(null);
  }

  async function save() {
    setError(null);
    const codigo = Number(form.codigo);
    if (!codigo || codigo <= 0) return setError("Código inválido.");
    if (!form.evento.trim()) return setError("Informe o evento.");

    const payload = {
      codigo,
      evento: form.evento.trim(),
      tipo: form.tipo,
      inss655: pct(form.inss655),
      inss515: pct(form.inss515),
      fgts: pct(form.fgts),
      provFerias: pct(form.provFerias),
      prov13: pct(form.prov13),
    };

    setBusy(true);
    try {
      const res = await fetch(editingCodigo ? `/api/encargos/${editingCodigo}` : "/api/encargos", {
        method: editingCodigo ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Falha ao salvar.");

      if (editingCodigo) {
        setItems((prev) => prev.map((it) => (it.codigo === editingCodigo ? data.encargo : it)));
      } else {
        setItems((prev) => [...prev, data.encargo].sort((a, b) => a.evento.localeCompare(b.evento)));
      }
      cancel();
    } catch {
      setError("Falha de rede ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(codigo: number) {
    setBusy(true);
    try {
      await fetch(`/api/encargos/${codigo}`, { method: "DELETE" });
      setItems((prev) => prev.filter((it) => it.codigo !== codigo));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por código ou evento…"
          className="w-full max-w-sm rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        />
        <span className="text-xs text-neutral-500">
          {filtrados.length} de {items.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Código</th>
              <th className="px-3 py-2 text-left font-medium">Evento</th>
              <th className="px-3 py-2 text-left font-medium">Tipo</th>
              <th className="px-3 py-2 text-right font-medium">INSS 655</th>
              <th className="px-3 py-2 text-right font-medium">INSS 515</th>
              <th className="px-3 py-2 text-right font-medium">FGTS</th>
              <th className="px-3 py-2 text-right font-medium">Prov. Férias</th>
              <th className="px-3 py-2 text-right font-medium">Prov. 13º</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {creating && <EditRow form={form} setForm={setForm} onSave={save} onCancel={cancel} busy={busy} />}
            {filtrados.map((e) =>
              editingCodigo === e.codigo ? (
                <EditRow key={e.codigo} form={form} setForm={setForm} onSave={save} onCancel={cancel} busy={busy} codigoFixo />
              ) : (
                <tr key={e.codigo} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 font-mono tabular-nums">{e.codigo}</td>
                  <td className="px-3 py-2">{e.evento}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs">{e.tipo}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{(e.inss655 * 100).toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{(e.inss515 * 100).toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{(e.fgts * 100).toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{(e.provFerias * 100).toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{(e.prov13 * 100).toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button type="button" onClick={() => startEdit(e)} className="text-emerald-700 hover:underline">
                      editar
                    </button>
                    <button type="button" onClick={() => remove(e.codigo)} className="ml-3 text-red-600 hover:underline">
                      remover
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

      {!creating && (
        <button
          type="button"
          onClick={startCreate}
          className="self-start rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          + Novo encargo
        </button>
      )}
    </div>
  );
}

function EditRow({
  form,
  setForm,
  onSave,
  onCancel,
  busy,
  codigoFixo,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
  codigoFixo?: boolean;
}) {
  const num = (key: keyof FormState, placeholder: string) => (
    <input
      value={form[key]}
      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      placeholder={placeholder}
      className="w-16 rounded border border-neutral-300 px-1.5 py-1 text-right text-sm"
    />
  );

  return (
    <tr className="bg-emerald-50/40">
      <td className="px-3 py-2">
        <input
          value={form.codigo}
          disabled={codigoFixo}
          onChange={(e) => setForm({ ...form, codigo: e.target.value })}
          placeholder="ex.: 150"
          className="w-20 rounded border border-neutral-300 px-2 py-1 text-sm disabled:bg-neutral-100"
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={form.evento}
          onChange={(e) => setForm({ ...form, evento: e.target.value })}
          placeholder="Nome do evento"
          className="w-full min-w-40 rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={form.tipo}
          onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoEvento })}
          className="rounded border border-neutral-300 px-1.5 py-1 text-sm"
        >
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-right">{num("inss655", "0")}%</td>
      <td className="px-3 py-2 text-right">{num("inss515", "0")}%</td>
      <td className="px-3 py-2 text-right">{num("fgts", "0")}%</td>
      <td className="px-3 py-2 text-right">{num("provFerias", "0")}%</td>
      <td className="px-3 py-2 text-right">{num("prov13", "0")}%</td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <button type="button" onClick={onSave} disabled={busy} className="text-emerald-700 hover:underline">
          salvar
        </button>
        <button type="button" onClick={onCancel} className="ml-3 text-neutral-500 hover:underline">
          cancelar
        </button>
      </td>
    </tr>
  );
}
