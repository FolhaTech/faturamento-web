"use client";

import { useMemo, useState } from "react";
import type { RubricaSomada, TomadorResumo } from "@/lib/calc/aggregate";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function fmt(n: number): string {
  return currency.format(n);
}

export function FaturamentoViewer({ resumos, warnings }: { resumos: TomadorResumo[]; warnings: string[] }) {
  const [tomadorCodigo, setTomadorCodigo] = useState<number | null>(resumos[0]?.tomadorCodigo ?? null);
  const resumo = useMemo(() => resumos.find((r) => r.tomadorCodigo === tomadorCodigo) ?? resumos[0] ?? null, [resumos, tomadorCodigo]);

  if (resumos.length === 0) {
    return <p className="text-sm text-neutral-500">Nenhum tomador com lançamentos nessa competência.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-neutral-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
          Tomador
          <select
            value={tomadorCodigo ?? ""}
            onChange={(e) => setTomadorCodigo(Number(e.target.value))}
            className="min-w-72 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-900"
          >
            {resumos.map((r) => (
              <option key={r.tomadorCodigo} value={r.tomadorCodigo}>
                {r.tomadorNome} ({r.qtdColaboradores} colab.)
              </option>
            ))}
          </select>
        </label>

        {resumo && (
          <a
            href={`/api/faturamento/export?competencia=${encodeURIComponent(resumo.competencia)}&tomador=${resumo.tomadorCodigo}`}
            className="ml-auto flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Exportar PDF
          </a>
        )}
      </div>

      {warnings.length > 0 && <WarningsPanel warnings={warnings} />}

      {resumo && (
        <>
          <TotalsCard resumo={resumo} />
          <RubricasTable resumo={resumo} />
          <ColaboradoresTable resumo={resumo} />
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

function TotalsCard({ resumo }: { resumo: TomadorResumo }) {
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
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {resumo.tomadorNome} — {resumo.competencia}
      </h2>
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

/** Uma rubrica sem despesa/fatura/NF é um evento Tipo D/FGTS/INSS — não conta na soma do faturamento (ver engine.ts). Não faz sentido ocupar espaço na tabela de faturamento. */
function contaNoFaturamento(r: RubricaSomada): boolean {
  return r.despesa !== 0 || r.fatura !== 0 || r.nf !== 0;
}

function RubricasTable({ resumo }: { resumo: TomadorResumo }) {
  const rubricasComImpacto = resumo.rubricas.filter(contaNoFaturamento);
  const ocultas = resumo.rubricas.length - rubricasComImpacto.length;

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
          {ocultas} evento(s) do tipo Desconto/FGTS/INSS não entram na soma do faturamento e por isso não aparecem nesta tabela.
        </p>
      )}
    </div>
  );
}

function ColaboradoresTable({ resumo }: { resumo: TomadorResumo }) {
  return (
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
          {resumo.colaboradores.map((c) => (
            <tr key={c.matricula} className="hover:bg-neutral-50">
              <Td mono>{c.matricula}</Td>
              <Td>{c.nome}</Td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-4 py-2 font-medium ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ children, right, mono }: { children: React.ReactNode; right?: boolean; mono?: boolean }) {
  return <td className={`px-4 py-2 ${right ? "text-right" : "text-left"} ${mono ? "font-mono tabular-nums" : ""}`}>{children}</td>;
}
