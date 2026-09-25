"use client";

import { Fragment, useState } from "react";
import type { Movimento } from "@/lib/types";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function fmt(n: number): string {
  return currency.format(n);
}

interface GrupoCcusto {
  ccustoCodigo: string;
  ccustoNome: string;
  lancamentos: Movimento[];
}

interface GrupoTomador {
  tomadorNome: string;
  totalLancamentos: number;
  ccustos: GrupoCcusto[];
}

/** Uma linha por Tomador — clicar numa linha abre o detalhamento dele (por Centro de Custo) logo abaixo, igual ao detalhamento por colaborador do Faturamento. */
export function TomadoresAccordion({
  grupos,
  semTomadorLabel,
  semCcustoCodigo,
}: {
  grupos: GrupoTomador[];
  semTomadorLabel: string;
  semCcustoCodigo: string;
}) {
  const [expandido, setExpandido] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <p className="px-1 text-xs text-neutral-400">Clique num Tomador pra ver os lançamentos dele, por Centro de Custo.</p>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <Th>Tomador</Th>
              <Th right>Centro(s) de custo</Th>
              <Th right>Lançamentos</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {grupos.map((g) => {
              const aberta = expandido === g.tomadorNome;
              return (
                <Fragment key={g.tomadorNome}>
                  <tr onClick={() => setExpandido(aberta ? null : g.tomadorNome)} className="cursor-pointer hover:bg-neutral-50" aria-expanded={aberta}>
                    <Td>
                      <span className="mr-1 inline-block w-3 text-neutral-400">{aberta ? "▾" : "▸"}</span>
                      <span className={g.tomadorNome === semTomadorLabel ? "text-amber-700" : ""}>{g.tomadorNome}</span>
                    </Td>
                    <Td right mono>
                      {g.ccustos.length}
                    </Td>
                    <Td right mono>
                      {g.totalLancamentos}
                    </Td>
                  </tr>
                  {aberta && (
                    <tr>
                      <td colSpan={3} className="bg-neutral-50 p-3">
                        <div className="flex flex-col gap-3">
                          {g.ccustos.map((c) => (
                            <div key={c.ccustoCodigo} className="flex flex-col gap-2">
                              <h3 className="flex items-baseline gap-2 px-1">
                                <span className={`text-sm font-semibold ${c.ccustoCodigo === semCcustoCodigo ? "text-amber-700" : "text-neutral-800"}`}>
                                  {c.ccustoNome}
                                </span>
                                <span className="text-xs text-neutral-400">{c.lancamentos.length} lançamento(s)</span>
                              </h3>
                              <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
                                <table className="w-full min-w-[900px] text-sm">
                                  <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                                    <tr>
                                      <Th>Matrícula</Th>
                                      <Th>Nome</Th>
                                      <Th>Código</Th>
                                      <Th>Evento</Th>
                                      <Th right>Valor</Th>
                                      <Th right>Ref</Th>
                                      <Th>Tipo</Th>
                                      <Th>Forma</Th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-neutral-100">
                                    {c.lancamentos.map((m) => (
                                      <tr key={m.id} className="hover:bg-neutral-100">
                                        <Td mono>{m.matricula}</Td>
                                        <Td>{m.nome}</Td>
                                        <Td mono>{m.codigo}</Td>
                                        <Td>{m.evento}</Td>
                                        <Td right mono>
                                          {fmt(m.valor)}
                                        </Td>
                                        <Td right mono>
                                          {m.ref}
                                        </Td>
                                        <Td>{m.tipo}</Td>
                                        <Td>{m.forma ?? "—"}</Td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
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
