"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ImportForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    const form = event.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      setError("Selecione um arquivo .xlsx ou .xls.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setBusy(true);
    try {
      const res = await fetch("/api/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falha ao importar o arquivo.");
        return;
      }
      setResult(
        `Importado: ${data.colaboradores} colaboradores, ${data.encargos} encargos, ${data.informativas} informativas, ${data.tomadores} tomadores.` +
          (data.avisos?.length ? ` Avisos: ${data.avisos.join(" ")}` : ""),
      );
      form.reset();
      setFileName(null);
      router.refresh();
    } catch {
      setError("Falha de rede ao enviar o arquivo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5">
      <div>
        <label htmlFor="file" className="block text-sm font-medium text-neutral-700 mb-1">
          Importar planilha-base (.xlsx ou .xls)
        </label>
        <p className="mb-2 text-xs text-neutral-500">
          Lê as abas Colaboradores, Encargos, Informativas e Tomadores e cadastra/atualiza os registros. Depois disso,
          tudo pode ser editado diretamente aqui.
        </p>
        <input
          id="file"
          name="file"
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          className="block w-full text-sm text-neutral-700 file:mr-4 file:rounded-md file:border-0 file:bg-emerald-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-800"
        />
        {fileName && <p className="mt-1 text-xs text-neutral-500">Selecionado: {fileName}</p>}
      </div>

      {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
      {result && <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">{result}</div>}

      <button
        type="submit"
        disabled={busy}
        className="self-start rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {busy ? "Importando…" : "Importar"}
      </button>
    </form>
  );
}
