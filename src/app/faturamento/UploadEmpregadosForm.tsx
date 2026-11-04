"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface Resumo {
  naPlanilha: number;
  criados?: number;
  atualizados: number;
  semAlteracao: number;
  naoCadastrados: number;
  linhasIgnoradas: number;
  duplicadas: number;
}

/**
 * Upload mensal da planilha "Empregados em Excel" do sistema de folha: atualiza a admissão e a rescisão de cada
 * colaborador cadastrado (aparecem no detalhamento por colaborador do Faturamento e nos PDFs). Não mexe em
 * Tomador, Centro de Custo nem nos outros dados do cadastro. Ver /api/colaboradores/vinculos.
 */
export function UploadEmpregadosForm({ modo = "vinculos" }: { modo?: "vinculos" | "cadastro" }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);
    setResumo(null);
    const file = (event.currentTarget.elements.namedItem("file") as HTMLInputElement).files?.[0];
    if (!file) {
      setErro("Selecione o arquivo .xls ou .xlsx de Empregados em Excel.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("modo", modo);

    setBusy(true);
    try {
      const res = await fetch("/api/colaboradores/vinculos", { method: "POST", body: formData });
      const texto = await res.text();
      let data: Record<string, unknown> | null = null;
      try {
        data = JSON.parse(texto);
      } catch {
        data = null;
      }
      if (!data) {
        setErro(
          `O servidor respondeu com erro (HTTP ${res.status}) sem detalhes${
            res.status === 413 ? " — o arquivo é maior que o limite de envio" : ""
          }. Confira o cadastro antes de enviar de novo.`,
        );
        return;
      }
      if (!res.ok) {
        setErro(typeof data.error === "string" ? data.error : `Falha ao processar o arquivo (HTTP ${res.status}).`);
        return;
      }
      setResumo(data as unknown as Resumo);
      formRef.current?.reset();
      setNomeArquivo(null);
      router.refresh();
    } catch {
      setErro("A conexão caiu ao enviar o arquivo — confira o cadastro antes de enviar de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={enviar} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">{modo === "cadastro" ? "Importar planilha de empregados" : "Admissão e rescisão dos colaboradores"}</h2>
        {modo === "cadastro" ? <p className="mt-1 text-xs text-neutral-600">
          Envie o arquivo <strong>Empregados em Excel</strong> (.xls ou .xlsx). O sistema atualiza os cadastros pela matrícula e inclui novos empregados. Os vínculos de Tomador e Centro de Custo ficam no cadastro do sistema.
        </p> : <p className="mt-1 text-xs text-neutral-500">
          Suba todo mês a planilha <strong>Empregados em Excel</strong> do sistema de folha. Ela atualiza a <strong>admissão</strong> e a <strong>rescisão</strong>{" "}
          (data e motivo) de cada colaborador já cadastrado, que passam a aparecer no detalhamento por colaborador do Faturamento e nos PDFs. Não altera Tomador,
          Centro de Custo nem os demais dados do cadastro.
        </p>}
      </div>
      <input
        name="file"
        aria-label="Planilha de empregados"
        type="file"
        accept=".xls,.xlsx"
        onChange={(e) => setNomeArquivo(e.target.files?.[0]?.name ?? null)}
        className="block w-full text-sm text-neutral-700 file:mr-4 file:rounded-md file:border-0 file:bg-emerald-700 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-800"
      />
      {nomeArquivo && <p className="text-xs text-neutral-500">Selecionado: {nomeArquivo}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {busy ? "Atualizando…" : modo === "cadastro" ? "Importar e atualizar cadastros" : "Atualizar admissões e rescisões"}
        </button>
      </div>
      {erro && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}
      {resumo && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <p className="font-medium">
            {resumo.naPlanilha} empregado(s) na planilha — {resumo.criados !== undefined && `${resumo.criados} novo(s), `}{resumo.atualizados} atualizado(s), {resumo.semAlteracao} já estavam iguais
            {resumo.naoCadastrados > 0 ? `, ${resumo.naoCadastrados} sem cadastro no sistema (ignorados)` : ""}.
          </p>
          {(resumo.linhasIgnoradas > 0 || resumo.duplicadas > 0) && (
            <p className="mt-1 text-xs">
              {resumo.linhasIgnoradas > 0 ? `${resumo.linhasIgnoradas} linha(s) inválida(s) ignorada(s). ` : ""}
              {resumo.duplicadas > 0 ? `${resumo.duplicadas} matrícula(s) repetida(s): valeu a última linha.` : ""}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
