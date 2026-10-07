"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { nomeBaseDoArquivo } from "@/lib/xlsx/ccustoDoNomeArquivo";

interface CompetenciaComDados {
  competencia: string;
  existentes: number;
  /** true = essa competência tem fatura ativa salva (de algum usuário) que também será descartada — ver faturasSalvas.ts. */
  faturaSalva: boolean;
}

interface PendingConfirm {
  file: File;
  competencias: CompetenciaComDados[];
  novosLancamentos: number;
}

export function UploadMovimentosForm({ ccustosCadastrados }: { ccustosCadastrados: string[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [tipo, setTipo] = useState<"previa" | "folha">("previa");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cadastrosNovos, setCadastrosNovos] = useState<{ matricula: number; nome: string }[]>([]);
  const [tomadoresNovos, setTomadoresNovos] = useState<{ codigo: number; nome: string }[]>([]);
  const [vinculadosAoArquivo, setVinculadosAoArquivo] = useState<{ matricula: number; nome: string }[]>([]);
  const [avisoTomadorArquivo, setAvisoTomadorArquivo] = useState<string | null>(null);
  const [ccustoCompletado, setCcustoCompletado] = useState<{ matricula: number; nome: string; ccusto: string }[]>([]);
  const [ccustoCorrigido, setCcustoCorrigido] = useState<{ matricula: number; nome: string; ccustoAntigo: string; ccustoNovo: string }[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  // Centro de custo de TODOS os colaboradores do arquivo (opcional) — vale mais que o do cadastro; ver /api/movimentos.
  const [ccusto, setCcusto] = useState("");
  const sugestaoCcusto = fileName ? nomeBaseDoArquivo(fileName) : "";
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  /** Retorna true quando o arquivo foi de fato importado (para o chamador decidir se limpa o form). */
  async function enviarArquivo(file: File, confirmar: boolean): Promise<boolean> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("tipo", tipo);
    if (confirmar) formData.append("confirmar", "true");
    if (ccusto.trim() !== "") formData.append("ccusto", ccusto.trim());

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/movimentos", { method: "POST", body: formData });
      // Resposta que não é JSON (timeout da Vercel, erro do servidor) não pode virar "falha de rede": o
      // servidor pode ter gravado tudo antes de a resposta falhar — a mensagem diz isso e o status HTTP.
      const texto = await res.text();
      // O formato muda conforme o status (409 de confirmação, erro, sucesso) — antes era o `any` do res.json().
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: Record<string, any> | null = null;
      try {
        data = JSON.parse(texto);
      } catch {
        data = null;
      }
      if (!data) {
        setError(
          `O servidor respondeu com erro (HTTP ${res.status}) sem detalhes — ${
            res.status === 504 || res.status === 502 ? "provavelmente demorou demais. " : ""
          }O arquivo pode ter sido importado mesmo assim: confira em Movimentos (competência do arquivo) antes de enviar de novo.`,
        );
        return false;
      }

      if (res.status === 409 && data.requerConfirmacao) {
        setPendingConfirm({ file, competencias: data.competencias, novosLancamentos: data.novosLancamentos });
        return false;
      }
      if (!res.ok) {
        setError(data.error ?? `Falha ao processar o arquivo (HTTP ${res.status}).`);
        return false;
      }

      setPendingConfirm(null);
      setInfo(`${data.importados} lançamento(s) importado(s) — competência(s): ${data.competencias.join(", ")}.`);
      setCadastrosNovos(data.cadastrosNovos ?? []);
      setTomadoresNovos(data.tomadoresNovos ?? []);
      setVinculadosAoArquivo(data.vinculadosAoArquivo ?? []);
      setAvisoTomadorArquivo(data.avisoTomadorArquivo ?? null);
      setCcustoCompletado(data.ccustoCompletado ?? []);
      setCcustoCorrigido(data.ccustoCorrigido ?? []);
      setFileName(null);
      // Depois de importar, vai direto pra tela de Movimentos (ver Ver Lançamentos) na
      // competência que acabou de subir — confirma na hora que ficou salvo de verdade, em vez de
      // voltar pra essa mesma tela de upload.
      const competenciaAlvo: string | undefined = data.competencias?.[0];
      if (competenciaAlvo) {
        router.push(`/movimentos?competencia=${encodeURIComponent(competenciaAlvo)}`);
      } else {
        router.refresh();
      }
      return true;
    } catch {
      setError("A conexão caiu ao enviar o arquivo — ele pode ter sido importado mesmo assim: confira em Movimentos antes de enviar de novo.");
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
    setTomadoresNovos([]);
    setVinculadosAoArquivo([]);
    setAvisoTomadorArquivo(null);
    setCcustoCompletado([]);
    setCcustoCorrigido([]);
    setPendingConfirm(null);
    const form = event.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      setError("Selecione um arquivo .xlsx ou .xls.");
      return;
    }
    const importou = await enviarArquivo(file, false);
    if (importou) {
      formRef.current?.reset();
      setCcusto("");
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5">
      <div>
        <span className="block text-sm font-medium text-neutral-700 mb-1">Esse cálculo é Prévia ou Folha?</span>
        <p className="mb-2 text-xs text-neutral-500">
          Prévia e Folha da mesma competência ficam salvas separadas — subir uma não apaga a outra, só substitui se
          reenviar o mesmo tipo de novo.
        </p>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-sm text-neutral-700">
            <input type="radio" name="tipoRadio" checked={tipo === "previa"} onChange={() => setTipo("previa")} />
            Prévia (meio do mês)
          </label>
          <label className="flex items-center gap-1.5 text-sm text-neutral-700">
            <input type="radio" name="tipoRadio" checked={tipo === "folha"} onChange={() => setTipo("folha")} />
            Folha (fechamento)
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="file" className="block text-sm font-medium text-neutral-700 mb-1">
          Arquivo de Movimentos do mês (.xlsx ou .xls)
        </label>
        <p className="mb-2 text-xs text-neutral-500">
          Cada upload só substitui os lançamentos dos colaboradores que estão NESSE arquivo — arquivos de outros
          clientes já importados pra mesma competência continuam intactos, então dá pra subir um arquivo por cliente
          sem apagar os demais. Se algum desses colaboradores já tiver lançamento salvo, pede confirmação antes de
          substituir. Usa os Colaboradores, Encargos e Tomadores já cadastrados para calcular o faturamento.
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

      <div>
        <label htmlFor="ccusto" className="block text-sm font-medium text-neutral-700 mb-1">
          Centro de custo deste arquivo (opcional)
        </label>
        <p className="mb-2 text-xs text-neutral-500">
          Use quando a planilha não diz o centro de custo. Todos os colaboradores do arquivo passam a ficar nele — escolha um já existente ou digite um
          novo (ex.: CHAMA PERECIVEL). Em branco, vale o centro de custo do cadastro de cada colaborador.
        </p>
        <input
          id="ccusto"
          list="ccustos-cadastrados"
          value={ccusto}
          onChange={(e) => setCcusto(e.target.value)}
          placeholder="Ex.: CHAMA PERECIVEL"
          className="block w-full max-w-md rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900"
        />
        <datalist id="ccustos-cadastrados">
          {ccustosCadastrados.map((nome) => (
            <option key={nome} value={nome} />
          ))}
        </datalist>
        {sugestaoCcusto !== "" && sugestaoCcusto !== ccusto.trim().toUpperCase() && (
          <button type="button" onClick={() => setCcusto(sugestaoCcusto)} className="mt-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
            Usar o nome do arquivo: {sugestaoCcusto}
          </button>
        )}
      </div>

      {error && <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
      {info && <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">{info}</div>}

      {pendingConfirm && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-medium">Alguns colaboradores desse arquivo já têm lançamento salvo nessas competências e serão substituídos:</p>
          <ul className="mt-1 list-disc pl-5">
            {pendingConfirm.competencias.map((c) => (
              <li key={c.competencia}>
                {c.competencia}: {c.existentes} lançamento(s) desses colaboradores serão substituídos pelo conteúdo do arquivo novo (o resto da
                competência, de outros clientes, não é afetado).
                {c.faturaSalva && (
                  <strong className="text-amber-950">
                    {" "}
                    Essa competência tem fatura salva (foto congelada) de algum usuário — ela também será descartada (continua na timeline, mas
                    quem salvou volta a ver o cálculo ao vivo).
                  </strong>
                )}
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
                if (importou) {
                  formRef.current?.reset();
                  setCcusto("");
                }
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

      {vinculadosAoArquivo.length > 0 && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <p className="font-medium">
            {vinculadosAoArquivo.length} colaborador(es) vinculado(s) automaticamente ao Tomador certo (pelo Centro de Custo, ou pela Empresa do
            arquivo quando o Centro de Custo não resolve sozinho) — já entram na fatura:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {vinculadosAoArquivo.map((c) => (
              <li key={c.matricula}>
                {c.matricula} — {c.nome}
              </li>
            ))}
          </ul>
        </div>
      )}

      {avisoTomadorArquivo && <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{avisoTomadorArquivo}</div>}

      {ccustoCompletado.length > 0 && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <p className="font-medium">{ccustoCompletado.length} colaborador(es) completado(s) com o Centro de Custo (&quot;Local de trabalho&quot;) do arquivo:</p>
          <ul className="mt-1 list-disc pl-5">
            {ccustoCompletado.map((c) => (
              <li key={c.matricula}>
                {c.matricula} — {c.nome} → {c.ccusto}
              </li>
            ))}
          </ul>
        </div>
      )}

      {ccustoCorrigido.length > 0 && (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          <p className="font-medium">
            {ccustoCorrigido.length} colaborador(es) tiveram o Centro de Custo corrigido — o arquivo diz outro diferente do que já estava cadastrado
            (colaborador mudou de obra):
          </p>
          <ul className="mt-1 list-disc pl-5">
            {ccustoCorrigido.map((c) => (
              <li key={c.matricula}>
                {c.matricula} — {c.nome}: {c.ccustoAntigo} → {c.ccustoNovo}
              </li>
            ))}
          </ul>
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
            <Link href="/colaboradores?situacao=Cadastro+pendente" className="underline hover:no-underline">
              complete o cadastro
            </Link>{" "}
            pra somarem na próxima vez que a página de Faturamento for calculada.
          </p>
        </div>
      )}

      {tomadoresNovos.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="font-medium">
            {tomadoresNovos.length} Cód Serviço (Tomador) referenciado(s) no arquivo não tinham cadastro em Tomadores — criei um cadastro
            mínimo (pendente) pra cada um:
          </p>
          <ul className="mt-1 list-disc pl-5">
            {tomadoresNovos.map((t) => (
              <li key={t.codigo}>
                {t.codigo} — {t.nome}
              </li>
            ))}
          </ul>
          <p className="mt-1">
            Sem FPAS e Taxa Adm eles ainda não entram no faturamento —{" "}
            <Link href="/tomadores" className="underline hover:no-underline">
              complete o cadastro
            </Link>{" "}
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
