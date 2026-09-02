"use client";

import { Fragment, useMemo, useState } from "react";
import type { CcustoResumo, ColaboradorResumo, RubricaSomada } from "@/lib/calc/aggregate";
import { normalizaTexto } from "@/lib/text";
import { GrossUpConfigForm } from "./GrossUpConfigForm";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function fmt(n: number): string {
  return currency.format(n);
}

export function FaturamentoViewer({
  resumos,
  warnings,
  filtrosQuery,
  regimeLabel = null,
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
}) {
  const [ccustoCodigo, setCcustoCodigo] = useState<string | null>(resumos[0]?.ccustoCodigo ?? null);
  const resumo = useMemo(() => resumos.find((r) => r.ccustoCodigo === ccustoCodigo) ?? resumos[0] ?? null, [resumos, ccustoCodigo]);

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
            }`}
            className="ml-auto flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Exportar PDF
          </a>
        )}
      </div>

      {warnings.length > 0 && <WarningsPanel warnings={warnings} />}

      {resumo && (
        <>
          <TotalsCard resumo={resumo} regimeLabel={regimeLabel} />
          <RubricasTable rubricas={resumo.rubricas} />
          <DescontosTable rubricas={resumo.rubricas} />
          <ColaboradoresTable colaboradores={resumo.colaboradores} />
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

function TotalsCard({ resumo, regimeLabel }: { resumo: CcustoResumo; regimeLabel: string | null }) {
  const rows: [string, number, boolean?][] = [
    ["Total de despesas", resumo.totalDespesas],
    ["Taxa administrativa", resumo.taxaAdministrativa],
    ["Fatura (despesas + taxa)", resumo.totalFaturaSemEncargos],
    ["Encargos (PIS/COFINS/ISS/CSLL/IRRF)", resumo.encargosFatura.total],
    ["Total fatura (com encargos)", resumo.totalFatura, true],
    ["Retenções na fonte", -resumo.retencoes.total],
    ["Valor líquido a receber", resumo.valorLiquido, true],
  ];
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
          fpas={resumo.fpas}
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
    </div>
  );
}

function RubricasTable({ rubricas }: { rubricas: RubricaSomada[] }) {
  const rubricasComImpacto = rubricas.filter((r) => r.trilha !== "excluido");
  const ocultas = rubricas.length - rubricasComImpacto.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[1240px] text-sm">
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
              <Th right>NF</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rubricasComImpacto.map((r) => (
              <tr key={r.evento} className="hover:bg-neutral-50">
                <Td>{r.evento}</Td>
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
                  {fmt(r.nf)}
                </Td>
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
function ColaboradoresTable({ colaboradores }: { colaboradores: ColaboradorResumo[] }) {
  const [expandida, setExpandida] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="px-1 text-sm font-semibold text-neutral-700">Detalhamento por colaborador — clique numa linha pra ver o detalhamento por evento dele</h3>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <Th>Matrícula</Th>
              <Th>Nome</Th>
              <Th right>Despesa</Th>
              <Th right>Taxa Adm</Th>
              <Th right>Fatura</Th>
              <Th right>NF</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {colaboradores.map((c) => {
              const aberta = expandida === c.matricula;
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
                      {fmt(c.nf)}
                    </Td>
                  </tr>
                  {aberta && (
                    <tr>
                      <td colSpan={6} className="bg-neutral-50 p-3">
                        <div className="flex flex-col gap-3">
                          <RubricasTable rubricas={c.rubricas} />
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

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-4 py-2 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, right, mono }: { children: React.ReactNode; right?: boolean; mono?: boolean }) {
  return <td className={`px-4 py-2 ${right ? "text-right" : "text-left"} ${mono ? "font-mono tabular-nums" : ""}`}>{children}</td>;
}
