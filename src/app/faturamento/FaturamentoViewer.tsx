"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CcustoResumo, ColaboradorResumo, RubricaSomada } from "@/lib/calc/aggregate";
import { normalizaTexto } from "@/lib/text";
import type { Encargo } from "@/lib/types";
import { DescontoProvisaoColaborador, type ProvisaoColaborador } from "./DescontoProvisaoColaborador";
import { GrossUpConfigForm } from "./GrossUpConfigForm";
import {
  adiantamentoAtivo,
  calcularCobranca,
  lerPercentual,
  lerValorReais,
  percentualAtivo,
  serializarAdiantamentos,
  serializarPercentuais,
  somarCobranca,
  type DeducaoColaborador,
} from "@/lib/percentualCobranca";
import { useAdiantamentos, usePercentuaisCobranca } from "./usePercentuaisCobranca";
import { RegimeColaborador, type TomadorOpcao } from "./RegimeColaborador";
import { TomadorCentroCusto } from "./TomadorCentroCusto";
import { formatarDataBr } from "@/lib/dataBr";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function fmt(n: number): string {
  return currency.format(n);
}

/** Admissão e rescisão de um colaborador (datas AAAA-MM-DD) — vêm da planilha mensal Empregados em Excel. */
export interface VinculoColaborador {
  matricula: number;
  admissao: string | null;
  dataDemissao: string | null;
  motivoDemissao: string | null;
}

export function FaturamentoViewer({
  resumos,
  warnings,
  filtrosQuery,
  regimeLabel = null,
  encargos,
  colaboradoresCc,
  colaboradoresProvisao,
  colaboradoresTomador,
  colaboradoresVinculo,
  tomadoresOpcoes,
  previaTotalFaturaPorCcusto,
  eventosExcluidos,
}: {
  resumos: CcustoResumo[];
  warnings: string[];
  /**
   * Filtros de colaborador (Cód Emp/Cargo/Dpto/Regime) ativos na tela, já como querystring —
   * repassados ao export de PDF pra não divergir do que está sendo mostrado. Precisa ser
   * string (não URLSearchParams): esse componente é Client e o valor cruza a fronteira
   * Server->Client como prop — um objeto URLSearchParams não sobrevive a essa serialização
   * (chega vazio no cliente), então os filtros somem silenciosamente do link do PDF.
   */
  filtrosQuery?: string;
  /** "Terceiro (CLT)" ou "Temporário" quando o filtro de Regime está ativo — mostrado junto do Tomador pra não confundir com a fatura sem esse filtro. */
  regimeLabel?: string | null;
  /** Cadastro completo de Encargos — usado pelos checkboxes de INSS/FGTS/Provisões por evento (ver EncargoComponentesToggle). */
  encargos: Encargo[];
  /** CC (não obrigatório) de cada colaborador mostrado — ver ColaboradoresTable/CcInput. Array (não Map) pelo mesmo motivo de filtrosQuery acima. */
  colaboradoresCc: { matricula: number; cc: string | null }[];
  /** Estado dos botões Sim/Não de Prov. Férias / Prov. 13º de cada colaborador mostrado — ver DescontoProvisaoColaborador. */
  colaboradoresProvisao: ProvisaoColaborador[];
  /** Tomador (Cód Serviço) atual de cada colaborador mostrado e a lista de Tomadores pra escolher — ver RegimeColaborador. */
  colaboradoresTomador: { matricula: number; codServico: number | null }[];
  /** Admissão e rescisão de cada colaborador mostrado (planilha mensal Empregados em Excel) — colunas do detalhamento por colaborador. */
  colaboradoresVinculo: VinculoColaborador[];
  tomadoresOpcoes: TomadorOpcao[];
  /** Total fatura (NF) já cobrado na Prévia do mesmo mês, por Centro de Custo — vazio quando a competência atual não é uma Folha ou não tem Prévia correspondente. Ver page.tsx. */
  previaTotalFaturaPorCcusto: { ccustoCodigo: string; totalFatura: number }[];
  /** Eventos excluídos manualmente da fatura, por colaborador (ver eventosExcluidos.ts) — usado só pro painel de restaurar, o cálculo já vem sem eles. */
  eventosExcluidos: { matricula: number; evento: string }[];
}) {
  const router = useRouter();
  const [ccustoCodigo, setCcustoCodigo] = useState<string | null>(resumos[0]?.ccustoCodigo ?? null);
  const [busyExclusao, setBusyExclusao] = useState(false);
  const resumo = useMemo(() => resumos.find((r) => r.ccustoCodigo === ccustoCodigo) ?? resumos[0] ?? null, [resumos, ccustoCodigo]);
  // Deduções digitadas por colaborador (campos na tabela de colaboradores): % a deduzir da Nota Fiscal e
  // adiantamento em reais — os dois saem do total dele. O card de totais soma e os links de PDF levam só
  // os do centro de custo mostrado. 0% / R$ 0 (ou vazio) é "sem dedução": o valor fica normal e o
  // colaborador nem entra nestes mapas.
  const [percentuaisTexto, setPercentualColaborador, limparPercentuais] = usePercentuaisCobranca(resumo?.competencia ?? "");
  const [adiantamentosTexto, setAdiantamentoColaborador, limparAdiantamentos] = useAdiantamentos(resumo?.competencia ?? "");
  const percentuaisDoCcusto = useMemo(() => {
    const doCcusto = new Set((resumo?.colaboradores ?? []).map((c) => c.matricula));
    const mapa = new Map<number, number>();
    for (const [matricula, texto] of Object.entries(percentuaisTexto)) {
      const percentual = percentualAtivo(texto);
      if (percentual !== null && doCcusto.has(Number(matricula))) mapa.set(Number(matricula), percentual);
    }
    return mapa;
  }, [percentuaisTexto, resumo]);
  const adiantamentosDoCcusto = useMemo(() => {
    const doCcusto = new Set((resumo?.colaboradores ?? []).map((c) => c.matricula));
    const mapa = new Map<number, number>();
    for (const [matricula, texto] of Object.entries(adiantamentosTexto)) {
      const valor = adiantamentoAtivo(texto);
      if (valor !== null && doCcusto.has(Number(matricula))) mapa.set(Number(matricula), valor);
    }
    return mapa;
  }, [adiantamentosTexto, resumo]);
  /** Quem tem alguma dedução (percentual > 0 e/ou adiantamento > 0) — base do card de totais. */
  const deducoesDoCcusto = useMemo(() => {
    const mapa = new Map<number, DeducaoColaborador>();
    for (const matricula of new Set([...percentuaisDoCcusto.keys(), ...adiantamentosDoCcusto.keys()])) {
      mapa.set(matricula, { percentual: percentuaisDoCcusto.get(matricula) ?? null, adiantamento: adiantamentosDoCcusto.get(matricula) ?? 0 });
    }
    return mapa;
  }, [percentuaisDoCcusto, adiantamentosDoCcusto]);
  /** Parâmetros do link de PDF com as deduções (só as dos colaboradores pedidos; todos quando `somente` é omitido). */
  function paramsDeducoes(somente?: number): string {
    const filtra = <T,>(mapa: Map<number, T>) => new Map([...mapa].filter(([m]) => somente === undefined || m === somente));
    const partes: string[] = [];
    const percentuais = filtra(percentuaisDoCcusto);
    const adiantamentos = filtra(adiantamentosDoCcusto);
    if (percentuais.size > 0) partes.push(`percentuais=${encodeURIComponent(serializarPercentuais(percentuais))}`);
    if (adiantamentos.size > 0) partes.push(`adiantamentos=${encodeURIComponent(serializarAdiantamentos(adiantamentos))}`);
    return partes.join("&");
  }

  /** Link do PDF individual de um colaborador: mesmos filtros da tela, mas só a matrícula dele (e o percentual dele, se houver). */
  function hrefPdfColaborador(matricula: number): string {
    const params = new URLSearchParams(filtrosQuery ?? "");
    if (resumo) {
      params.set("competencia", resumo.competencia);
      params.set("ccusto", resumo.ccustoCodigo);
    }
    params.set("colaborador", String(matricula));
    const deducoes = paramsDeducoes(matricula);
    return `/api/faturamento/export?${params.toString()}${deducoes ? `&${deducoes}` : ""}`;
  }
  const encargosPorCodigo = useMemo(() => new Map(encargos.map((e) => [e.codigo, e])), [encargos]);
  const ccPorMatricula = useMemo(() => new Map(colaboradoresCc.map((c) => [c.matricula, c.cc])), [colaboradoresCc]);
  const provisaoPorMatricula = useMemo(() => new Map(colaboradoresProvisao.map((p) => [p.matricula, p])), [colaboradoresProvisao]);
  const vinculoPorMatricula = useMemo(() => new Map(colaboradoresVinculo.map((v) => [v.matricula, v])), [colaboradoresVinculo]);
  const codServicoPorMatricula = useMemo(() => new Map(colaboradoresTomador.map((c) => [c.matricula, c.codServico])), [colaboradoresTomador]);
  const previaPorCcusto = useMemo(() => new Map(previaTotalFaturaPorCcusto.map((p) => [p.ccustoCodigo, p.totalFatura])), [previaTotalFaturaPorCcusto]);
  const eventosExcluidosPorMatricula = useMemo(() => {
    const map = new Map<number, { matricula: number; evento: string }[]>();
    for (const e of eventosExcluidos) {
      const arr = map.get(e.matricula) ?? [];
      arr.push(e);
      map.set(e.matricula, arr);
    }
    return map;
  }, [eventosExcluidos]);

  async function excluirEvento(matricula: number, nomeColaborador: string, evento: string) {
    if (!resumo) return;
    if (!window.confirm(`Excluir "${evento}" da fatura de ${nomeColaborador}?\n\nNão afeta os demais colaboradores — dá pra restaurar depois.`)) {
      return;
    }
    setBusyExclusao(true);
    try {
      const res = await fetch("/api/faturamento/eventos-excluidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matricula, competencia: resumo.competencia, evento }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusyExclusao(false);
    }
  }

  async function restaurarEvento(matricula: number, evento: string) {
    if (!resumo) return;
    setBusyExclusao(true);
    try {
      const params = new URLSearchParams({ matricula: String(matricula), competencia: resumo.competencia, evento });
      const res = await fetch(`/api/faturamento/eventos-excluidos?${params.toString()}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setBusyExclusao(false);
    }
  }

  if (resumos.length === 0) {
    return <p className="text-sm text-neutral-500">Nenhum centro de custo com lançamentos nessa competência.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-neutral-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
          Centro de custo
          <select
            value={ccustoCodigo ?? ""}
            onChange={(e) => setCcustoCodigo(e.target.value)}
            className="min-w-72 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900"
          >
            {resumos.map((r) => (
              <option key={r.ccustoCodigo} value={r.ccustoCodigo}>
                {r.ccustoNome} ({r.qtdColaboradores} colab.)
              </option>
            ))}
          </select>
        </label>

        {resumo && (
          <a
            href={`/api/faturamento/export?competencia=${encodeURIComponent(resumo.competencia)}&ccusto=${encodeURIComponent(resumo.ccustoCodigo)}${
              filtrosQuery ? `&${filtrosQuery}` : ""
            }${deducoesDoCcusto.size > 0 ? `&${paramsDeducoes()}` : ""}`}
            className="ml-auto flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Exportar PDF
          </a>
        )}
        {resumo && previaPorCcusto.has(resumo.ccustoCodigo) && (
          <a
            href={`/api/faturamento/export-comparativo?competencia=${encodeURIComponent(resumo.competencia)}&ccusto=${encodeURIComponent(resumo.ccustoCodigo)}`}
            className="flex items-center gap-2 rounded-md bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800"
          >
            Exportar comparativo Prévia × Folha
          </a>
        )}
      </div>

      {warnings.length > 0 && <WarningsPanel warnings={warnings} />}

      {resumo && (
        <>
          <TotalsCard
            resumo={resumo}
            regimeLabel={regimeLabel}
            previaTotalFatura={previaPorCcusto.get(resumo.ccustoCodigo) ?? null}
            deducoes={deducoesDoCcusto}
            onLimparDeducoes={() => {
              limparPercentuais([...percentuaisDoCcusto.keys()]);
              limparAdiantamentos([...adiantamentosDoCcusto.keys()]);
            }}
          />
          <TomadorCentroCusto
            ccustoNome={resumo.ccustoNome}
            matriculas={resumo.colaboradores.map((c) => c.matricula)}
            codServicoAtuais={resumo.colaboradores.map((c) => codServicoPorMatricula.get(c.matricula) ?? null)}
            tomadores={tomadoresOpcoes}
          />
          <RubricasTable rubricas={resumo.rubricas} encargosPorCodigo={encargosPorCodigo} />
          <DescontosTable rubricas={resumo.rubricas} />
          <ColaboradoresTable
            colaboradores={resumo.colaboradores}
            encargosPorCodigo={encargosPorCodigo}
            ccPorMatricula={ccPorMatricula}
            percentuaisTexto={percentuaisTexto}
            onPercentualChange={setPercentualColaborador}
            adiantamentosTexto={adiantamentosTexto}
            onAdiantamentoChange={setAdiantamentoColaborador}
            hrefPdfColaborador={hrefPdfColaborador}
            competencia={resumo.competencia}
            provisaoPorMatricula={provisaoPorMatricula}
            codServicoPorMatricula={codServicoPorMatricula}
            vinculoPorMatricula={vinculoPorMatricula}
            tomadoresOpcoes={tomadoresOpcoes}
            eventosExcluidosPorMatricula={eventosExcluidosPorMatricula}
            onExcluir={excluirEvento}
            onRestaurar={restaurarEvento}
            busyExclusao={busyExclusao}
          />
        </>
      )}
    </div>
  );
}

function WarningsPanel({ warnings }: { warnings: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium text-amber-800">
        <span>{warnings.length} aviso(s) durante o cálculo</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul className="max-h-64 overflow-y-auto border-t border-amber-200 px-4 py-2 text-xs text-amber-800">
          {warnings.map((w, i) => (
            <li key={i} className="py-0.5">
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TotalsCard({
  resumo,
  regimeLabel,
  previaTotalFatura,
  deducoes,
  onLimparDeducoes,
}: {
  resumo: CcustoResumo;
  regimeLabel: string | null;
  /** Total fatura (NF) já cobrado na Prévia do mesmo mês — null quando não há Prévia correspondente pra comparar (ver FaturamentoViewer). */
  previaTotalFatura: number | null;
  /** Dedução (percentual > 0 e/ou adiantamento > 0) de cada colaborador desse centro de custo (matrícula -> dedução) — vazio quando nenhum foi digitado. */
  deducoes: Map<number, DeducaoColaborador>;
  /** Apaga os percentuais e adiantamentos desse centro de custo (volta tudo ao valor normal). */
  onLimparDeducoes: () => void;
}) {
  // As deduções digitadas por colaborador (percentual + adiantamento) também reduzem o "Valor líquido a receber".
  const deduzido = somarCobranca(resumo.colaboradores, deducoes).deduzido;
  const rows: [string, number, boolean?][] = [
    ["Total de despesas", resumo.totalDespesas],
    ["Taxa administrativa", resumo.taxaAdministrativa],
    ["Fatura (despesas + taxa)", resumo.totalFaturaSemEncargos],
    ["Encargos (PIS/COFINS/ISS/CSLL/IRRF)", resumo.encargosFatura.total],
    ["Total fatura (com encargos)", resumo.totalFatura, true],
    ["Retenções na fonte", -resumo.retencoes.total],
    ...(deduzido > 0 ? ([["Deduções por colaborador (% e adiantamento)", -deduzido]] as [string, number, boolean?][]) : []),
    ["Valor líquido a receber", resumo.valorLiquido - deduzido, true],
  ];
  const complementar = previaTotalFatura == null ? null : resumo.totalFatura - previaTotalFatura;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {resumo.ccustoNome} — {resumo.competencia}
          </h2>
          <p className="text-xs text-neutral-400">
            Tomador: {resumo.tomadorNome}
            {regimeLabel && ` · Regime: ${regimeLabel}`}
          </p>
        </div>
        <GrossUpConfigForm
          key={resumo.tomadorCodigo}
          tomadorCodigo={resumo.tomadorCodigo}
          tomadorNome={resumo.tomadorNome}
          grossUpInicial={resumo.tomadorGrossUp}
          grossUpOperacaoInicial={resumo.tomadorGrossUpOperacao}
        />
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
        {rows.map(([label, value, strong]) => (
          <div key={label} className="flex items-baseline justify-between border-b border-dashed border-neutral-200 py-1">
            <dt className={strong ? "font-medium text-neutral-900" : "text-neutral-600"}>{label}</dt>
            <dd className={`font-mono tabular-nums ${strong ? "font-semibold text-neutral-900" : "text-neutral-700"}`}>{fmt(value)}</dd>
          </div>
        ))}
      </dl>
      <CobrancaResumo resumo={resumo} deducoes={deducoes} onLimpar={onLimparDeducoes} />
      {complementar != null && (
        <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Comparação com a Prévia</p>
          <dl className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
            <div className="flex items-baseline justify-between py-0.5">
              <dt className="text-sky-800">Total fatura já cobrado na Prévia</dt>
              <dd className="font-mono tabular-nums text-sky-900">{fmt(previaTotalFatura!)}</dd>
            </div>
            <div className="flex items-baseline justify-between py-0.5">
              <dt className="font-medium text-sky-900">{complementar >= 0 ? "Complementar a cobrar" : "Complementar a creditar"} (Folha − Prévia)</dt>
              <dd className={`font-mono font-semibold tabular-nums ${complementar >= 0 ? "text-sky-900" : "text-amber-700"}`}>{fmt(complementar)}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

function RubricasTable({
  rubricas,
  encargosPorCodigo,
  excluir,
}: {
  rubricas: RubricaSomada[];
  encargosPorCodigo: Map<number, Encargo>;
  /** Presente só na tabela do detalhamento por colaborador (não na do resumo do Centro de Custo inteiro) — dá um botão de excluir por linha, que tira o evento da fatura só desse colaborador (ver excluirEvento em FaturamentoViewer). */
  excluir?: { nomeColaborador: string; onExcluir: (evento: string) => void | Promise<void>; busy: boolean };
}) {
  const rubricasComImpacto = rubricas.filter((r) => r.trilha !== "excluido");
  const ocultas = rubricas.length - rubricasComImpacto.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[1360px] text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <Th>Evento</Th>
              <Th right>Valor</Th>
              <Th right>INSS</Th>
              <Th right>FGTS</Th>
              <Th right>Prov. Férias</Th>
              <Th right>Prov. 13º</Th>
              <Th right>Enc. INSS/Prov.</Th>
              <Th right>Enc. FGTS/Prov.</Th>
              <Th right>Total Provisões</Th>
              <Th right>Despesa (BASE)</Th>
              <Th right>Taxa Adm</Th>
              <Th right>Fatura</Th>
              <Th right>Tributação</Th>
              <Th right>Nota Fiscal</Th>
              {excluir && <Th right>{""}</Th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rubricasComImpacto.map((r) => (
              <tr key={r.evento} className="hover:bg-neutral-50">
                <Td>
                  {r.evento}
                  <EncargoComponentesToggle codigo={r.codigo} evento={r.evento} tipo={r.tipo} encargo={encargosPorCodigo.get(r.codigo)} />
                </Td>
                <Td right mono>
                  {fmt(r.valorBruto)}
                </Td>
                <Td right mono>
                  {fmt(r.inss)}
                </Td>
                <Td right mono>
                  {fmt(r.fgts)}
                </Td>
                <Td right mono>
                  {fmt(r.provFerias)}
                </Td>
                <Td right mono>
                  {fmt(r.prov13)}
                </Td>
                <Td right mono>
                  {fmt(r.encInss)}
                </Td>
                <Td right mono>
                  {fmt(r.encFgts)}
                </Td>
                <Td right mono>
                  <span className="font-medium text-neutral-700">{fmt(r.totalProvisoes)}</span>
                </Td>
                <Td right mono>
                  <span className="font-semibold text-neutral-900">{fmt(r.despesa)}</span>
                </Td>
                <Td right mono>
                  {fmt(r.taxaAdm)}
                </Td>
                <Td right mono>
                  {fmt(r.fatura)}
                </Td>
                <Td right mono>
                  {fmt(r.impostos)}
                </Td>
                <Td right mono>
                  <span className="font-semibold text-neutral-900">{fmt(r.nf)}</span>
                </Td>
                {excluir && (
                  <Td right>
                    <button
                      type="button"
                      disabled={excluir.busy}
                      onClick={() => excluir.onExcluir(r.evento)}
                      title={`Excluir "${r.evento}" só da fatura de ${excluir.nomeColaborador}`}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Excluir
                    </button>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ocultas > 0 && (
        <p className="px-1 text-xs text-neutral-400">
          {ocultas} evento(s) do tipo Desconto/FGTS/INSS não entram na soma do faturamento — veja a tabela de descontos abaixo.
        </p>
      )}
    </div>
  );
}

/** Lista os eventos excluídos manualmente da fatura desse colaborador, com opção de restaurar (ver excluirEvento/restaurarEvento em FaturamentoViewer). */
function EventosExcluidosPanel({
  eventos,
  onRestaurar,
  busy,
}: {
  eventos: { matricula: number; evento: string }[];
  onRestaurar: (evento: string) => void | Promise<void>;
  busy: boolean;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
      <p className="font-medium">{eventos.length} evento(s) excluído(s) manualmente da fatura desse colaborador — não entram no total dele:</p>
      <ul className="mt-1.5 flex flex-wrap gap-2">
        {eventos.map((e) => (
          <li key={e.evento} className="flex items-center gap-2 rounded-md border border-amber-300 bg-white px-2.5 py-1">
            <span>{e.evento}</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => onRestaurar(e.evento)}
              className="text-xs font-medium text-amber-800 underline hover:no-underline disabled:opacity-50"
            >
              Restaurar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Checkboxes rápidos pra ligar/desligar INSS, FGTS e Provisões (Férias+13º) de um evento sem
 * precisar saber os percentuais de cor — chama /api/encargos/[codigo]/componentes, que aplica
 * as alíquotas padrão (iguais a DIAS NORMAIS) quando ligado, ou zera quando desligado.
 */
function EncargoComponentesToggle({
  codigo,
  evento,
  tipo,
  encargo,
}: {
  codigo: number;
  evento: string;
  tipo: RubricaSomada["tipo"];
  encargo: Encargo | undefined;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [estado, setEstado] = useState(() => ({
    inss: (encargo?.inss515 ?? 0) > 0 || (encargo?.inss655 ?? 0) > 0,
    fgts: (encargo?.fgts ?? 0) > 0,
    provisoes: (encargo?.provFerias ?? 0) > 0 || (encargo?.prov13 ?? 0) > 0,
  }));

  async function toggle(campo: "inss" | "fgts" | "provisoes") {
    const estadoAnterior = estado;
    const novoEstado = { ...estado, [campo]: !estado[campo] };
    setEstado(novoEstado);
    setBusy(true);
    try {
      const res = await fetch(`/api/encargos/${codigo}/componentes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evento, tipo, ...novoEstado }),
      });
      if (!res.ok) {
        setEstado(estadoAnterior);
        return;
      }
      router.refresh();
    } catch {
      setEstado(estadoAnterior);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1 flex gap-2 text-[10px] font-normal text-neutral-400" onClick={(e) => e.stopPropagation()}>
      <label className="flex cursor-pointer items-center gap-0.5" title="Aplica INSS 515/655 (28,8%/25,5%) quando ligado.">
        <input type="checkbox" checked={estado.inss} disabled={busy} onChange={() => toggle("inss")} className="h-3 w-3" />
        INSS
      </label>
      <label className="flex cursor-pointer items-center gap-0.5" title="Aplica FGTS (8%) quando ligado.">
        <input type="checkbox" checked={estado.fgts} disabled={busy} onChange={() => toggle("fgts")} className="h-3 w-3" />
        FGTS
      </label>
      <label className="flex cursor-pointer items-center gap-0.5" title="Aplica Prov. Férias (11,11%) + Prov. 13º (8,33%) quando ligado.">
        <input type="checkbox" checked={estado.provisoes} disabled={busy} onChange={() => toggle("provisoes")} className="h-3 w-3" />
        Prov.
      </label>
    </div>
  );
}

function tipoLabel(tipo: RubricaSomada["tipo"], evento: string): string {
  if (normalizaTexto(evento).includes("REEMBOLSO")) return "Reembolso";
  if (tipo === "D" || tipo === "R") return "Desconto";
  if (tipo === "FGTS" || tipo === "INSS") return "Informativo";
  return tipo;
}

/** Rubricas Tipo D/R (desconto real do holerite) e FGTS/INSS (restatement informativo) — não somam faturamento, mas o colaborador precisa ver o que foi retido/reafirmado. */
function DescontosTable({ rubricas }: { rubricas: RubricaSomada[] }) {
  const descontos = rubricas.filter((r) => r.trilha === "excluido");
  if (descontos.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="px-1 text-sm font-semibold text-neutral-700">Descontos e linhas informativas</h3>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <Th>Evento</Th>
              <Th>Tipo</Th>
              <Th right>Lançamentos</Th>
              <Th right>Valor</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {descontos.map((r) => (
              <tr key={r.evento} className="hover:bg-neutral-50">
                <Td>{r.evento}</Td>
                <Td>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      r.tipo === "D" || r.tipo === "R" ? "bg-red-50 text-red-700" : "bg-neutral-100 text-neutral-600"
                    }`}
                  >
                    {tipoLabel(r.tipo, r.evento)}
                  </span>
                </Td>
                <Td right mono>
                  {r.qtdLancamentos}
                </Td>
                <Td right mono>
                  <span className={r.valorBruto < 0 ? "text-red-700" : "text-neutral-700"}>{fmt(r.valorBruto)}</span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-1 text-xs text-neutral-400">
        Descontos (Tipo D/R) são retidos do holerite do colaborador e não reduzem a fatura cobrada do tomador. Linhas informativas (FGTS/INSS) só
        reafirmam um valor já embutido no provento correspondente.
      </p>
    </div>
  );
}

/** Cada linha abre o detalhamento por evento (rubricas) daquele colaborador — mesmas colunas da tabela de rubricas do centro de custo inteiro, só que restrita a ele. */
function ColaboradoresTable({
  colaboradores,
  encargosPorCodigo,
  ccPorMatricula,
  percentuaisTexto,
  onPercentualChange,
  adiantamentosTexto,
  onAdiantamentoChange,
  hrefPdfColaborador,
  competencia,
  provisaoPorMatricula,
  codServicoPorMatricula,
  vinculoPorMatricula,
  tomadoresOpcoes,
  eventosExcluidosPorMatricula,
  onExcluir,
  onRestaurar,
  busyExclusao,
}: {
  colaboradores: ColaboradorResumo[];
  encargosPorCodigo: Map<number, Encargo>;
  /** CC (não obrigatório) de cada colaborador — ver CcInput. */
  ccPorMatricula: Map<number, string | null>;
  /** Percentual a deduzir digitado de cada colaborador (matrícula -> texto) e o setter — ver PercentualInput. */
  percentuaisTexto: Record<string, string>;
  onPercentualChange: (matricula: number, novo: string) => void;
  /** Adiantamento em reais digitado de cada colaborador (matrícula -> texto) e o setter — ver AdiantamentoInput. */
  adiantamentosTexto: Record<string, string>;
  onAdiantamentoChange: (matricula: number, novo: string) => void;
  /** Link do PDF individual de um colaborador (botão "PDF" da linha dele). */
  hrefPdfColaborador: (matricula: number) => string;
  /** Competência mostrada — pra qual os botões de Prov. Férias / Prov. 13º lançam o desconto. */
  competencia: string;
  provisaoPorMatricula: Map<number, ProvisaoColaborador>;
  /** Tomador atual de cada colaborador + Tomadores disponíveis — alimentam o seletor de regime (ver RegimeColaborador). */
  codServicoPorMatricula: Map<number, number | null>;
  /** Admissão e rescisão de cada colaborador — colunas "Admissão" e "Rescisão" (motivo no tooltip). */
  vinculoPorMatricula: Map<number, VinculoColaborador>;
  tomadoresOpcoes: TomadorOpcao[];
  /** Eventos excluídos manualmente, por matrícula (ver eventosExcluidos.ts) — pro painel de restaurar dentro do detalhamento de cada colaborador. */
  eventosExcluidosPorMatricula: Map<number, { matricula: number; evento: string }[]>;
  onExcluir: (matricula: number, nomeColaborador: string, evento: string) => void | Promise<void>;
  onRestaurar: (matricula: number, evento: string) => void | Promise<void>;
  busyExclusao: boolean;
}) {
  const [expandida, setExpandida] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="px-1 text-sm font-semibold text-neutral-700">Detalhamento por colaborador — clique numa linha pra ver o detalhamento por evento dele</h3>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[1620px] text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <Th>Matrícula</Th>
              <Th>Nome</Th>
              <Th>CC</Th>
              <Th>Admissão</Th>
              <Th>Rescisão</Th>
              <Th right>Despesa</Th>
              <Th right>Taxa Adm</Th>
              <Th right>Fatura</Th>
              <Th right>Tributação</Th>
              <Th right>Nota Fiscal</Th>
              <Th right>% a deduzir</Th>
              <Th right>Adiantamento</Th>
              <Th right>Valor a cobrar</Th>
              <Th right>Deduzido</Th>
              <Th right>PDF</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {colaboradores.map((c) => {
              const aberta = expandida === c.matricula;
              const percentualTexto = percentuaisTexto[String(c.matricula)] ?? "";
              const percentual = percentualAtivo(percentualTexto);
              const adiantamentoTexto = adiantamentosTexto[String(c.matricula)] ?? "";
              const adiantamento = adiantamentoAtivo(adiantamentoTexto);
              const cobranca = calcularCobranca(c.nf, percentual, adiantamento ?? 0);
              const temDeducao = percentual !== null || adiantamento !== null;
              // Adiantamento maior que o que sobra do total dele deixaria o valor a cobrar negativo — avisa no campo.
              const adiantamentoAlto = adiantamento !== null && cobranca.cobrar < 0;
              return (
                <Fragment key={c.matricula}>
                  <tr
                    onClick={() => setExpandida(aberta ? null : c.matricula)}
                    className="cursor-pointer hover:bg-neutral-50"
                    aria-expanded={aberta}
                  >
                    <Td mono>{c.matricula}</Td>
                    <Td>
                      <span className="mr-1 inline-block w-3 text-neutral-400">{aberta ? "▾" : "▸"}</span>
                      {c.nome}
                    </Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      <CcInput matricula={c.matricula} ccInicial={ccPorMatricula.get(c.matricula) ?? null} />
                    </Td>
                    <Td mono>{formatarDataBr(vinculoPorMatricula.get(c.matricula)?.admissao) ?? <span className="text-neutral-300">—</span>}</Td>
                    <Td mono>
                      {formatarDataBr(vinculoPorMatricula.get(c.matricula)?.dataDemissao) ? (
                        <span title={vinculoPorMatricula.get(c.matricula)?.motivoDemissao ?? undefined} className="text-red-700">
                          {formatarDataBr(vinculoPorMatricula.get(c.matricula)?.dataDemissao)}
                        </span>
                      ) : (
                        <span className="text-neutral-300">—</span>
                      )}
                    </Td>
                    <Td right mono>
                      {fmt(c.despesa)}
                    </Td>
                    <Td right mono>
                      {fmt(c.taxaAdm)}
                    </Td>
                    <Td right mono>
                      {fmt(c.fatura)}
                    </Td>
                    <Td right mono>
                      {fmt(c.impostos)}
                    </Td>
                    <Td right mono>
                      <span className="font-semibold text-neutral-900">{fmt(c.nf)}</span>
                    </Td>
                    <Td right onClick={(e) => e.stopPropagation()}>
                      <PercentualInput
                        texto={percentualTexto}
                        invalido={percentualTexto.trim() !== "" && lerPercentual(percentualTexto) === null}
                        onChange={(novo) => onPercentualChange(c.matricula, novo)}
                      />
                    </Td>
                    <Td right onClick={(e) => e.stopPropagation()}>
                      <AdiantamentoInput
                        texto={adiantamentoTexto}
                        invalido={(adiantamentoTexto.trim() !== "" && lerValorReais(adiantamentoTexto) === null) || adiantamentoAlto}
                        aviso={adiantamentoAlto ? "Adiantamento maior que o total do colaborador após o percentual" : undefined}
                        onChange={(novo) => onAdiantamentoChange(c.matricula, novo)}
                      />
                    </Td>
                    <Td right mono>
                      {!temDeducao ? <span className="text-neutral-300">—</span> : <span className="font-semibold text-emerald-800">{fmt(cobranca.cobrar)}</span>}
                    </Td>
                    <Td right mono>
                      {!temDeducao ? <span className="text-neutral-300">—</span> : fmt(cobranca.deduzido)}
                    </Td>
                    <Td right onClick={(e) => e.stopPropagation()}>
                      <a
                        href={hrefPdfColaborador(c.matricula)}
                        title={`Exportar o PDF individual de ${c.nome}`}
                        className="inline-block rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800"
                      >
                        PDF
                      </a>
                    </Td>
                  </tr>
                  {aberta && (
                    <tr>
                      <td colSpan={15} className="bg-neutral-50 p-3">
                        <div className="flex flex-col gap-3">
                          <RegimeColaborador matricula={c.matricula} codServicoAtual={codServicoPorMatricula.get(c.matricula) ?? null} tomadores={tomadoresOpcoes} />
                          {provisaoPorMatricula.has(c.matricula) && (
                            <DescontoProvisaoColaborador matricula={c.matricula} competencia={competencia} provisao={provisaoPorMatricula.get(c.matricula)!} />
                          )}
                          <RubricasTable
                            rubricas={c.rubricas}
                            encargosPorCodigo={encargosPorCodigo}
                            excluir={{ nomeColaborador: c.nome, onExcluir: (evento) => onExcluir(c.matricula, c.nome, evento), busy: busyExclusao }}
                          />
                          {(eventosExcluidosPorMatricula.get(c.matricula)?.length ?? 0) > 0 && (
                            <EventosExcluidosPanel
                              eventos={eventosExcluidosPorMatricula.get(c.matricula)!}
                              onRestaurar={(evento) => onRestaurar(c.matricula, evento)}
                              busy={busyExclusao}
                            />
                          )}
                          <DescontosTable rubricas={c.rubricas} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Percentual da Nota Fiscal do colaborador a DEDUZIR (ex.: 20) — 0 ou vazio deixa o valor normal; o valor a cobrar e o deduzido saem ao lado e vão no PDF; lembrado neste navegador. */
function PercentualInput({ texto, invalido, onChange }: { texto: string; invalido: boolean; onChange: (novo: string) => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        value={texto}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder="—"
        aria-label="Percentual a deduzir"
        className={`w-16 rounded-md border px-2 py-1 text-right text-xs text-neutral-900 ${invalido ? "border-red-400 bg-red-50" : "border-neutral-300"}`}
      />
      <span className="text-xs text-neutral-500">%</span>
    </span>
  );
}

/** Adiantamento em reais (ex.: 1.500,00) deduzido do total do colaborador, somado à dedução do percentual — R$ 0 ou vazio = sem adiantamento; vai no PDF; lembrado neste navegador. */
function AdiantamentoInput({ texto, invalido, aviso, onChange }: { texto: string; invalido: boolean; aviso?: string; onChange: (novo: string) => void }) {
  return (
    <span className="inline-flex items-center gap-1" title={aviso}>
      <span className="text-xs text-neutral-500">R$</span>
      <input
        value={texto}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder="—"
        aria-label="Adiantamento em reais"
        className={`w-24 rounded-md border px-2 py-1 text-right text-xs text-neutral-900 ${invalido ? "border-red-400 bg-red-50" : "border-neutral-300"}`}
      />
    </span>
  );
}

/** Soma por colaborador do que será cobrado e do que foi deduzido (percentual + adiantamento) — só aparece quando algum colaborador tem dedução. Colaborador sem dedução entra com a NF inteira. */
function CobrancaResumo({ resumo, deducoes, onLimpar }: { resumo: CcustoResumo; deducoes: Map<number, DeducaoColaborador>; onLimpar: () => void }) {
  if (deducoes.size === 0) return null;
  const { cobrar, deduzido, adiantamentos } = somarCobranca(resumo.colaboradores, deducoes);
  return (
    <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Dedução por colaborador (% a deduzir e adiantamento)</p>
        <button type="button" onClick={onLimpar} className="text-xs font-medium text-emerald-800 hover:underline">
          Limpar deduções
        </button>
      </div>
      <dl className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-3">
        <div className="flex items-baseline justify-between py-0.5">
          <dt className="text-emerald-900">Total fatura (NF)</dt>
          <dd className="font-mono tabular-nums text-emerald-900">{fmt(resumo.totalFatura)}</dd>
        </div>
        <div className="flex items-baseline justify-between py-0.5">
          <dt className="font-medium text-emerald-900">Valor a cobrar</dt>
          <dd className="font-mono font-semibold tabular-nums text-emerald-900">{fmt(cobrar)}</dd>
        </div>
        <div className="flex items-baseline justify-between py-0.5">
          <dt className="text-neutral-600">Deduzido{adiantamentos > 0 ? ` (inclui ${fmt(adiantamentos)} de adiantamento)` : ""}</dt>
          <dd className="font-mono tabular-nums text-neutral-700">{fmt(deduzido)}</dd>
        </div>
      </dl>
      <p className="mt-1 text-xs text-neutral-500">
        {deducoes.size} colaborador(es) com dedução — os demais entram com a Nota Fiscal inteira. O valor deduzido também reduz o &quot;Valor líquido a receber&quot; acima (as retenções continuam sobre o Total fatura). 0% / R$ 0 ou campo vazio deixa o valor normal. Preencha as colunas &quot;% a deduzir&quot; e &quot;Adiantamento&quot; do detalhamento por colaborador; o PDF exportado leva esses valores.
      </p>
    </div>
  );
}

/** Campo livre, não obrigatório, digitado direto nessa tela — salva ao sair do campo (blur). Ver /api/colaboradores/[matricula]/cc. */
function CcInput({ matricula, ccInicial }: { matricula: number; ccInicial: string | null }) {
  const router = useRouter();
  const [valor, setValor] = useState(ccInicial ?? "");
  const [busy, setBusy] = useState(false);

  async function salvar() {
    if (valor === (ccInicial ?? "")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/colaboradores/${matricula}/cc`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cc: valor }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <input
      value={valor}
      onChange={(e) => setValor(e.target.value)}
      onBlur={salvar}
      disabled={busy}
      placeholder="—"
      className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-900"
    />
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-4 py-2 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({
  children,
  right,
  mono,
  onClick,
}: {
  children: React.ReactNode;
  right?: boolean;
  mono?: boolean;
  onClick?: React.MouseEventHandler<HTMLTableCellElement>;
}) {
  return (
    <td onClick={onClick} className={`px-4 py-2 ${right ? "text-right" : "text-left"} ${mono ? "font-mono tabular-nums" : ""}`}>
      {children}
    </td>
  );
}
