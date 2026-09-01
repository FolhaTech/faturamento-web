"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface CompetenciaComDados {
  competencia: string;
  existentes: number;
}

interface PendingConfirm {
  file: File;
  competencias: CompetenciaComDados[];
  novosLancamentos: number;
}

export function UploadMovimentosForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cadastrosNovos, setCadastrosNovos] = useState<{ matricula: number; nome: string }[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  /** Retorna true quando o arquivo foi de fato importado (para o chamador decidir se limpa o form). */
  async function enviarArquivo(file: File, confirmar: boolean): Promise<boolean> {
    const formData = new FormData();
    formData.append("file", file);
    if (confirmar) formData.append("confirmar", "true");

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/movimentos", { method: "POST", body: formData });
      const data = await res.json();

      if (res.status === 409 && data.requerConfirmacao) {
        setPendingConfirm({ file, competencias: data.competencias, novosLancamentos: data.novosLancamentos });
        return false;
      }
      if (!res.ok) {
        setError(data.error ?? "Falha ao processar o arquivo.");
        return false;
      }

      setPendingConfirm(null);
      setInfo(`${data.importados} lançamento(s) importado(s) — competência(s): ${data.competencias.join(", ")}.`);
      setCadastrosNovos(data.cadastrosNovos ?? []);
      setFileName(null);
      router.refresh();
      return true;
    } catch {
      setError("Falha de rede ao enviar o arquivo.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setCadastrosNovos([]);
    setPendingConfirm(null);
    const form = event.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      setError("Selecione um arquivo .xlsx ou .xls.");
      return;
    }
    const importou = await enviarArquivo(file, false);
    if (importou) formRef.current?.reset();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5">
      <div>
        <label htmlFor="file" className="block text-sm font-medium text-neutral-700 mb-1">
          Arquivo de Movimentos do mês (.xlsx ou .xls)
        </label>
        <p className="mb-2 text-xs text-neutral-500">
          Reenviar um arquivo de uma competência que já tem lançamentos salvos pede confirmação antes de substituir
          (não duplica, nem substitui sem avisar). Usa os Colaboradores, Encargos e Tomadores já cadastrados para
          calcular o faturamento.
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
      {info && <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">{info}</div>}

      {pendingConfirm && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-medium">Essas competências já têm lançamentos salvos e serão substituídas:</p>
          <ul className="mt-1 list-disc pl-5">
            {pendingConfirm.competencias.map((c) => (
              <li key={c.competencia}>
                {c.competencia}: {c.existentes} lançamento(s) salvo(s) hoje serão apagados e substituídos pelo conteúdo do arquivo novo.
              </li>
            ))}
          </ul>
          <p className="mt-2">O arquivo selecionado tem {pendingConfirm.novosLancamentos} lançamento(s) no total. Confirma a substituição?</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const importou = await enviarArquivo(pendingConfirm.file, true);
                if (importou) formRef.current?.reset();
              }}
              className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50"
            >
              {busy ? "Substituindo…" : "Confirmar substituição"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPendingConfirm(null)}
              className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {cadastrosNovos.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="font-medium">
            {cadastrosNovos.length} matrícula(s) do arquivo não tinham cadastro em Colaboradores — criei um cadastro mínimo (situação
            &quot;Cadastro pendente&quot;) pra cada uma:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {cadastrosNovos.map((c) => (
              <li key={c.matricula}>
                {c.matricula} — {c.nome}
              </li>
            ))}
          </ul>
          <p className="mt-1">
            Sem Cód Serviço (Tomador) elas ainda não entram no faturamento —{" "}
            <a href="/colaboradores?situacao=Cadastro+pendente" className="underline hover:no-underline">
              complete o cadastro
            </a>{" "}
            pra somarem na próxima vez que a página de Faturamento for calculada.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="self-start rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {busy ? "Importando…" : "Importar e calcular"}
      </button>
    </form>
  );
}
