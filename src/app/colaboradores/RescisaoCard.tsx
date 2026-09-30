"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function fmt(n: number): string {
  return currency.format(n);
}

interface ProvisaoMensalView {
  competencia: string;
  provFerias: number;
  prov13: number;
}

interface DescontoSaldoView {
  competencia: string;
  tipo: "ferias" | "terco";
  valor: number;
}

interface DescontoPorCompetencia {
  competencia: string;
  ferias: number;
  terco: number;
}

/** Agrupa os lançamentos (férias e 13º separados na tabela) por competência, pra listar um lançamento por mês em vez de misturar tudo num total só. */
function agruparDescontosPorCompetencia(descontos: DescontoSaldoView[]): DescontoPorCompetencia[] {
  const porCompetencia = new Map<string, DescontoPorCompetencia>();
  for (const d of descontos) {
    const linha = porCompetencia.get(d.competencia) ?? { competencia: d.competencia, ferias: 0, terco: 0 };
    linha[d.tipo] += Math.abs(d.valor);
    porCompetencia.set(d.competencia, linha);
  }
  return [...porCompetencia.values()].sort((a, b) => a.competencia.localeCompare(b.competencia));
}

function parseInputCurrency(value: string): number {
  const cleaned = value.replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

function inputValue(n: number): string {
  return n > 0 ? n.toFixed(2).replace(".", ",") : "";
}

/** Histórico mês a mês da provisão de férias/13º que a Folha gerou pra esse colaborador — salvo automaticamente a cada Folha enviada (ver provisoesMensais.ts) — menos o que já foi pago via Desconto de saldo (ver descontosSaldo.ts). Líquido no rodapé é a base pra calcular uma rescisão. */
export function RescisaoCard({
  matricula,
  provisoes,
  descontos,
}: {
  matricula: number;
  provisoes: ProvisaoMensalView[];
  descontos: DescontoSaldoView[];
}) {
  const router = useRouter();
  const totalProvFerias = provisoes.reduce((soma, p) => soma + p.provFerias, 0);
  const totalProv13 = provisoes.reduce((soma, p) => soma + p.prov13, 0);
  const descontosPorCompetencia = agruparDescontosPorCompetencia(descontos);
  const totalDescontoFerias = descontosPorCompetencia.reduce((soma, d) => soma + d.ferias, 0);
  const totalDesconto13 = descontosPorCompetencia.reduce((soma, d) => soma + d.terco, 0);
  const liquidoFerias = totalProvFerias - totalDescontoFerias;
  const liquido13 = totalProv13 - totalDesconto13;

  const [editando, setEditando] = useState<string | null>(null);
  const [valoresEdicao, setValoresEdicao] = useState<{ ferias: string; terco: string }>({ ferias: "", terco: "" });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function iniciarEdicao(d: DescontoPorCompetencia) {
    setEditando(d.competencia);
    setValoresEdicao({ ferias: inputValue(d.ferias), terco: inputValue(d.terco) });
    setErro(null);
  }

  function cancelarEdicao() {
    setEditando(null);
    setValoresEdicao({ ferias: "", terco: "" });
    setErro(null);
  }

  async function salvarEdicao(competencia: string) {
    const ferias = parseInputCurrency(valoresEdicao.ferias);
    const terco = parseInputCurrency(valoresEdicao.terco);
    if (Number.isNaN(ferias) || Number.isNaN(terco)) {
      setErro("Valor inválido.");
      return;
    }

    setBusy(true);
    setErro(null);
    try {
      const res = await fetch(`/api/colaboradores/${matricula}/desconto-saldo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competencia, ferias, terco }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Falha ao salvar.");
        return;
      }
      setEditando(null);
      router.refresh();
    } catch {
      setErro("Falha de rede ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  async function excluir(competencia: string) {
    if (!confirm(`Excluir o desconto lançado em ${competencia}?`)) return;

    setBusy(true);
    setErro(null);
    try {
      const res = await fetch(`/api/colaboradores/${matricula}/desconto-saldo`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competencia }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? "Falha ao excluir.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Falha de rede ao excluir.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">Rescisão — provisão acumulada</h2>
      <p className="text-xs text-neutral-500">
        Prov. Férias e Prov. 13º que a Folha (fechamento) gerou pra esse colaborador, mês a mês, menos o que já foi
        pago via Desconto de saldo (esse dinheiro já foi quitado com ele) — salvo sozinho a cada Folha enviada ou
        desconto lançado, sem precisar digitar nada aqui. O líquido no rodapé é a base pra calcular uma rescisão.
      </p>
      {provisoes.length === 0 ? (
        <p className="text-sm text-neutral-400">Nenhuma Folha enviada ainda pra esse colaborador.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Competência</th>
                <th className="px-3 py-2 text-right font-medium">Prov. Férias</th>
                <th className="px-3 py-2 text-right font-medium">Prov. 13º</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {provisoes.map((p) => (
                <tr key={p.competencia} className="hover:bg-neutral-50">
                  <td className="px-3 py-2">{p.competencia}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(p.provFerias)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(p.prov13)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-300 bg-neutral-50 font-semibold text-neutral-900">
                <td className="px-3 py-2">Subtotal provisão</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(totalProvFerias)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(totalProv13)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {descontosPorCompetencia.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">(−) Desconto lançado em</th>
                <th className="px-3 py-2 text-right font-medium">Férias</th>
                <th className="px-3 py-2 text-right font-medium">13º</th>
                <th className="px-3 py-2 text-center font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {descontosPorCompetencia.map((d) => {
                const emEdicao = editando === d.competencia;
                return (
                  <tr key={d.competencia} className="hover:bg-neutral-50">
                    <td className="px-3 py-2">{d.competencia}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {emEdicao ? (
                        <input
                          value={valoresEdicao.ferias}
                          onChange={(e) => setValoresEdicao((v) => ({ ...v, ferias: e.target.value }))}
                          disabled={busy}
                          className="w-28 rounded-md border border-neutral-300 px-2 py-1 text-right text-sm font-mono"
                        />
                      ) : d.ferias > 0 ? (
                        fmt(d.ferias)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {emEdicao ? (
                        <input
                          value={valoresEdicao.terco}
                          onChange={(e) => setValoresEdicao((v) => ({ ...v, terco: e.target.value }))}
                          disabled={busy}
                          className="w-28 rounded-md border border-neutral-300 px-2 py-1 text-right text-sm font-mono"
                        />
                      ) : d.terco > 0 ? (
                        fmt(d.terco)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {emEdicao ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => salvarEdicao(d.competencia)}
                            disabled={busy}
                            className="text-xs font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={cancelarEdicao}
                            disabled={busy}
                            className="text-xs font-medium text-neutral-500 hover:text-neutral-700 disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => iniciarEdicao(d)}
                            disabled={busy}
                            className="text-xs font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => excluir(d.competencia)}
                            disabled={busy}
                            className="text-xs font-medium text-red-700 hover:text-red-800 disabled:opacity-50"
                          >
                            Excluir
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-300 bg-neutral-50 font-semibold text-neutral-900">
                <td className="px-3 py-2">Subtotal desconto</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(totalDescontoFerias)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(totalDesconto13)}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {erro && <p className="text-sm text-red-700">{erro}</p>}

      {(provisoes.length > 0 || descontosPorCompetencia.length > 0) && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
          <span>Acumulado líquido</span>
          <span className="font-mono tabular-nums">
            férias {fmt(liquidoFerias)} · 13º {fmt(liquido13)}
          </span>
        </div>
      )}
    </div>
  );
}
