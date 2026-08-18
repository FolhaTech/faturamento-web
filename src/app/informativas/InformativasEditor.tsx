"use client";

import { useState } from "react";
import type { Informativa } from "@/lib/types";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

interface FormState {
  codigo: string;
  evento: string;
  valor: string;
  recorrencia: string;
  inicio: string;
  obs: string;
}

function toForm(i: Informativa): FormState {
  return {
    codigo: i.codigo ? String(i.codigo) : "",
    evento: i.evento,
    valor: String(i.valor),
    recorrencia: i.recorrencia ?? "",
    inicio: i.inicio ?? "",
    obs: i.obs ?? "",
  };
}

const EMPTY: FormState = { codigo: "", evento: "", valor: "", recorrencia: "", inicio: "", obs: "" };

export function InformativasEditor({ initial }: { initial: Informativa[] }) {
  const [items, setItems] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit(i: Informativa) {
    setEditingId(i.id);
    setCreating(false);
    setForm(toForm(i));
  }

  function startCreate() {
    setCreating(true);
    setEditingId(null);
    setForm(EMPTY);
  }

  function cancel() {
    setEditingId(null);
    setCreating(false);
    setError(null);
  }

  async function save() {
    setError(null);
    if (!form.evento.trim()) return setError("Informe o evento.");
    const valor = Number(form.valor.replace(",", "."));
    if (!Number.isFinite(valor) || valor < 0) return setError("Valor inválido.");

    const payload = {
      codigo: form.codigo.trim() ? Number(form.codigo) : null,
      evento: form.evento.trim(),
      valor,
      recorrencia: form.recorrencia.trim() || null,
      inicio: form.inicio || null,
      obs: form.obs.trim() || null,
    };

    setBusy(true);
    try {
      const res = await fetch(editingId ? `/api/informativas/${editingId}` : "/api/informativas", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Falha ao salvar.");

      if (editingId) {
        setItems((prev) => prev.map((it) => (it.id === editingId ? data.informativa : it)));
      } else {
        setItems((prev) => [...prev, data.informativa].sort((a, b) => a.evento.localeCompare(b.evento)));
      }
      cancel();
    } catch {
      setError("Falha de rede ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/informativas/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((it) => it.id !== id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Código</th>
              <th className="px-3 py-2 text-left font-medium">Evento</th>
              <th className="px-3 py-2 text-right font-medium">Valor</th>
              <th className="px-3 py-2 text-left font-medium">Recorrência</th>
              <th className="px-3 py-2 text-left font-medium">Início</th>
              <th className="px-3 py-2 text-left font-medium">Obs.</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {creating && <EditRow form={form} setForm={setForm} onSave={save} onCancel={cancel} busy={busy} />}
            {items.map((i) =>
              editingId === i.id ? (
                <EditRow key={i.id} form={form} setForm={setForm} onSave={save} onCancel={cancel} busy={busy} />
              ) : (
                <tr key={i.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 font-mono tabular-nums">{i.codigo ?? "—"}</td>
                  <td className="px-3 py-2">
                    {i.evento}
                    {i.valor <= 0 && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        sem valor
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{currency.format(i.valor)}</td>
                  <td className="px-3 py-2 text-neutral-600">{i.recorrencia ?? "—"}</td>
                  <td className="px-3 py-2 text-neutral-600">{i.inicio ?? "—"}</td>
                  <td className="px-3 py-2 text-neutral-600">{i.obs ?? "—"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button type="button" onClick={() => startEdit(i)} className="text-emerald-700 hover:underline">
                      editar
                    </button>
                    <button type="button" onClick={() => remove(i.id)} className="ml-3 text-red-600 hover:underline">
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
          + Novo item
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
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <tr className="bg-emerald-50/40">
      <td className="px-3 py-2">
        <input
          value={form.codigo}
          onChange={(e) => setForm({ ...form, codigo: e.target.value })}
          placeholder="opcional"
          className="w-20 rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={form.evento}
          onChange={(e) => setForm({ ...form, evento: e.target.value })}
          placeholder="Nome do benefício"
          className="w-full min-w-40 rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <input
          value={form.valor}
          onChange={(e) => setForm({ ...form, valor: e.target.value })}
          placeholder="0,00"
          className="w-24 rounded border border-neutral-300 px-2 py-1 text-right text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={form.recorrencia}
          onChange={(e) => setForm({ ...form, recorrencia: e.target.value })}
          placeholder="Valor fixo mensal"
          className="w-36 rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="date"
          value={form.inicio}
          onChange={(e) => setForm({ ...form, inicio: e.target.value })}
          className="rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={form.obs}
          onChange={(e) => setForm({ ...form, obs: e.target.value })}
          placeholder="Observação"
          className="w-36 rounded border border-neutral-300 px-2 py-1 text-sm"
        />
      </td>
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
