"use client";

import { useState } from "react";
import type { Tomador } from "@/lib/types";

interface FormState {
  codigo: string;
  nome: string;
  fpas: "515" | "655";
  taxaAdm: string;
}

const EMPTY: FormState = { codigo: "", nome: "", fpas: "655", taxaAdm: "" };

export function TomadoresEditor({ initial }: { initial: Tomador[] }) {
  const [items, setItems] = useState(initial);
  const [editingCodigo, setEditingCodigo] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit(t: Tomador) {
    setEditingCodigo(t.codigo);
    setCreating(false);
    setForm({ codigo: String(t.codigo), nome: t.nome, fpas: String(t.fpas) as "515" | "655", taxaAdm: String(t.taxaAdm * 100) });
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
    const taxaAdm = Number(form.taxaAdm.replace(",", ".")) / 100;
    if (!codigo || codigo <= 0) return setError("Código inválido.");
    if (!form.nome.trim()) return setError("Informe o nome.");
    if (!Number.isFinite(taxaAdm) || taxaAdm < 0) return setError("Taxa administrativa inválida.");

    const payload = { codigo, nome: form.nome.trim(), fpas: Number(form.fpas) as 515 | 655, taxaAdm };

    setBusy(true);
    try {
      const res = await fetch(editingCodigo ? `/api/tomadores/${editingCodigo}` : "/api/tomadores", {
        method: editingCodigo ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Falha ao salvar.");

      if (editingCodigo) {
        setItems((prev) => prev.map((it) => (it.codigo === editingCodigo ? data.tomador : it)));
      } else {
        setItems((prev) => [...prev, data.tomador].sort((a, b) => a.nome.localeCompare(b.nome)));
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
      await fetch(`/api/tomadores/${codigo}`, { method: "DELETE" });
      setItems((prev) => prev.filter((it) => it.codigo !== codigo));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Código</th>
              <th className="px-4 py-2 text-left font-medium">Tomador</th>
              <th className="px-4 py-2 text-left font-medium">FPAS</th>
              <th className="px-4 py-2 text-left font-medium">Taxa Adm</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {items.map((t) =>
              editingCodigo === t.codigo ? (
                <EditRow key={t.codigo} form={form} setForm={setForm} onSave={save} onCancel={cancel} busy={busy} codigoFixo />
              ) : (
                <tr key={t.codigo} className="hover:bg-neutral-50">
                  <td className="px-4 py-2 font-mono tabular-nums">{t.codigo}</td>
                  <td className="px-4 py-2">
                    {t.nome}
                    {t.pendente && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Cadastro pendente</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {t.fpas} <span className="text-neutral-400">({t.fpas === 515 ? "Terceiro" : "Temporário"})</span>
                  </td>
                  <td className="px-4 py-2 font-mono tabular-nums">{(t.taxaAdm * 100).toLocaleString("pt-BR")}%</td>
                  <td className="px-4 py-2 text-right">
                    <button type="button" onClick={() => startEdit(t)} className="text-emerald-700 hover:underline">
                      editar
                    </button>
                    <button type="button" onClick={() => remove(t.codigo)} className="ml-3 text-red-600 hover:underline">
                      remover
                    </button>
                  </td>
                </tr>
              ),
            )}
            {creating && <EditRow form={form} setForm={setForm} onSave={save} onCancel={cancel} busy={busy} />}
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
          + Novo tomador
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
  return (
    <tr className="bg-emerald-50/40">
      <td className="px-4 py-2">
        <input
          value={form.codigo}
          disabled={codigoFixo}
          onChange={(e) => setForm({ ...form, codigo: e.target.value })}
          placeholder="ex.: 36"
          className="w-20 rounded border border-neutral-300 px-2 py-1 text-sm disabled:bg-neutral-100"
        />
      </td>
      <td className="px-4 py-2">
        <input
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          placeholder="Razão social"
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </td>
      <td className="px-4 py-2">
        <select
          value={form.fpas}
          onChange={(e) => setForm({ ...form, fpas: e.target.value as "515" | "655" })}
          className="rounded border border-neutral-300 px-2 py-1 text-sm"
        >
          <option value="515">515 — Terceiro</option>
          <option value="655">655 — Temporário</option>
        </select>
      </td>
      <td className="px-4 py-2">
        <input
          value={form.taxaAdm}
          onChange={(e) => setForm({ ...form, taxaAdm: e.target.value })}
          placeholder="ex.: 12"
          className="w-20 rounded border border-neutral-300 px-2 py-1 text-sm"
        />
        %
      </td>
      <td className="px-4 py-2 text-right">
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
