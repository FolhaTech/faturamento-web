"use client";

import { useRouter } from "next/navigation";
import { mesReserva } from "@/lib/calc/reservasFaturadas";
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

/** Provisão lançada à mão na ficha do colaborador (férias, 13º ou aviso prévio) — valor positivo; entra na fatura e soma na provisão acumulada. */
interface ProvisaoLancadaView {
  competencia: string;
  tipo: "ferias" | "terco" | "aviso";
  valor: number;
  /** false = guardado mas fora da fatura (só o aviso prévio fica assim) — não soma no acumulado. */
  aplicado: boolean;
}

/** Crédito da reserva da Folha (desconto) — abate da provisão acumulada. */
interface DescontoSaldoView {
  competencia: string;
  tipo: "ferias" | "terco";
  valor: number;
  gerenciado?: boolean;
  automatico?: boolean;
}

/** Um grupo editável de uma competência: as provisões lançadas à mão (gerenciado = false) ou os créditos da reserva da Folha (gerenciado = true). */
interface GrupoPorCompetencia {
  competencia: string;
  gerenciado: boolean;
  ferias: number;
  terco: number;
}

/** Uma linha da tabela: o mês, a provisão que a Folha gerou nele, a que foi lançada à mão, o aviso prévio lançado e o crédito da reserva da Folha. */
interface LinhaRescisao {
  competencia: string;
  temProvisao: boolean;
  provFerias: number;
  prov13: number;
  lancada: GrupoPorCompetencia | null;
  aviso: { valor: number; aplicado: boolean } | null;
  reserva: GrupoPorCompetencia | null;
}

/** Identifica um grupo editável: a mesma competência pode ter provisão lançada e crédito da reserva da Folha. */
function chaveLinha(g: GrupoPorCompetencia): string {
  return g.competencia + (g.gerenciado ? ":reserva" : ":lancada");
}

/**
 * Junta, numa tabela só, a provisão de cada mês (da Folha e lançada à mão), o aviso prévio lançado e o crédito da reserva — um mês por linha,
 * mais recente primeiro. Mês que só tem lançamento (sem provisão da Folha) também ganha linha.
 */
function montarLinhas(provisoes: ProvisaoMensalView[], lancadas: ProvisaoLancadaView[], creditos: DescontoSaldoView[]): LinhaRescisao[] {
  const mapa = new Map<string, LinhaRescisao>();
  const linhaDe = (competencia: string): LinhaRescisao => {
    const existente = mapa.get(competencia);
    if (existente) return existente;
    const nova: LinhaRescisao = { competencia, temProvisao: false, provFerias: 0, prov13: 0, lancada: null, aviso: null, reserva: null };
    mapa.set(competencia, nova);
    return nova;
  };
  for (const p of provisoes) {
    const l = linhaDe(p.competencia);
    l.temProvisao = true;
    l.provFerias += p.provFerias;
    l.prov13 += p.prov13;
  }
  for (const v of lancadas) {
    const l = linhaDe(v.competencia);
    if (v.tipo === "aviso") {
      l.aviso = { valor: Math.abs(v.valor), aplicado: v.aplicado };
      continue;
    }
    if (!v.aplicado) continue;
    l.lancada = l.lancada ?? { competencia: v.competencia, gerenciado: false, ferias: 0, terco: 0 };
    l.lancada[v.tipo] += Math.abs(v.valor);
  }
  for (const c of creditos) {
    const l = linhaDe(c.competencia);
    l.reserva = l.reserva ?? { competencia: c.competencia, gerenciado: true, ferias: 0, terco: 0 };
    l.reserva[c.tipo] += Math.abs(c.valor);
  }
  return [...mapa.values()].sort((a, b) => (mesReserva(b.competencia) ?? -1) - (mesReserva(a.competencia) ?? -1) || b.competencia.localeCompare(a.competencia));
}

/** O grupo pode editar esse tipo? A reserva da Folha só edita o que já tem; a provisão lançada à mão edita os dois (férias e 13º). */
function podeEditarTipo(g: GrupoPorCompetencia, tipo: "ferias" | "terco"): boolean {
  return g.gerenciado ? g[tipo] > 0 : true;
}

function parseInputCurrency(value: string): number {
  const cleaned = value.replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

function inputValue(n: number): string {
  return n > 0 ? n.toFixed(2).replace(".", ",") : "";
}

const CLASSE_INPUT = "w-28 rounded-md border border-neutral-300 px-2 py-1 text-right text-sm font-mono";

/**
 * Rescisão — provisão acumulada: uma tabela com, mês a mês, a provisão de férias e de 13º (a que a Folha gerou — salva automaticamente a
 * cada Folha enviada, ver provisoesMensais.ts — somada à que foi LANÇADA à mão no card acima) e a provisão de aviso prévio lançada. Os
 * valores vão somando mês a mês. O que a reserva da Folha creditou ("Reserva da Folha") abate nas colunas (−) Desc. O líquido no rodapé é
 * a provisão (Folha + lançada) menos esses créditos.
 */
export function RescisaoCard({
  matricula,
  provisoes,
  lancadas,
  descontos,
  competenciaAtual,
}: {
  matricula: number;
  /** Provisão de férias e 13º que a Folha gerou, por mês. */
  provisoes: ProvisaoMensalView[];
  /** Provisões lançadas à mão na ficha (férias, 13º e aviso prévio), de qualquer competência. */
  lancadas: ProvisaoLancadaView[];
  /** Créditos da reserva da Folha (descontos) de férias e 13º. */
  descontos: DescontoSaldoView[];
  competenciaAtual: string | null;
}) {
  const router = useRouter();
  const linhas = montarLinhas(provisoes, lancadas, descontos);
  const totalProvFerias = provisoes.reduce((soma, p) => soma + p.provFerias, 0);
  const totalProv13 = provisoes.reduce((soma, p) => soma + p.prov13, 0);
  const lancadasAplicadas = lancadas.filter((v) => v.aplicado);
  const totalLancadoFerias = lancadasAplicadas.filter((v) => v.tipo === "ferias").reduce((soma, v) => soma + Math.abs(v.valor), 0);
  const totalLancado13 = lancadasAplicadas.filter((v) => v.tipo === "terco").reduce((soma, v) => soma + Math.abs(v.valor), 0);
  const totalAviso = lancadasAplicadas.filter((v) => v.tipo === "aviso").reduce((soma, v) => soma + Math.abs(v.valor), 0);
  const totalDescontoFerias = descontos.filter((d) => d.tipo === "ferias").reduce((soma, d) => soma + Math.abs(d.valor), 0);
  const totalDesconto13 = descontos.filter((d) => d.tipo === "terco").reduce((soma, d) => soma + Math.abs(d.valor), 0);
  const acumuladoFerias = totalProvFerias + totalLancadoFerias;
  const acumulado13 = totalProv13 + totalLancado13;
  const liquidoFerias = acumuladoFerias - totalDescontoFerias;
  const liquido13 = acumulado13 - totalDesconto13;
  const mesAtual = competenciaAtual ? mesReserva(competenciaAtual) : null;
  const feriasAbatidasNoMes = mesAtual !== null && descontos.some((d) => d.tipo === "ferias" && d.automatico && mesReserva(d.competencia) === mesAtual);
  const saldoAposFerias = feriasAbatidasNoMes
    ? (provisoes.reduce((total, p) => {
        const mes = mesReserva(p.competencia);
        return mes !== null && mes < mesAtual ? total + Math.round(p.provFerias * 100) : total;
      }, 0) +
        lancadasAplicadas.reduce((total, v) => {
          const mes = mesReserva(v.competencia);
          return v.tipo === "ferias" && mes !== null && mes < mesAtual ? total + Math.round(Math.abs(v.valor) * 100) : total;
        }, 0) -
        descontos.reduce((total, d) => {
          const mes = mesReserva(d.competencia);
          return d.tipo === "ferias" && mes !== null && mes <= mesAtual ? total + Math.round(Math.abs(d.valor) * 100) : total;
        }, 0)) / 100
    : null;

  const [editando, setEditando] = useState<string | null>(null);
  const [valoresEdicao, setValoresEdicao] = useState<{ ferias: string; terco: string }>({ ferias: "", terco: "" });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function iniciarEdicao(g: GrupoPorCompetencia) {
    setEditando(chaveLinha(g));
    setValoresEdicao({ ferias: inputValue(g.ferias), terco: inputValue(g.terco) });
    setErro(null);
  }

  function cancelarEdicao() {
    setEditando(null);
    setValoresEdicao({ ferias: "", terco: "" });
    setErro(null);
  }

  async function salvarEdicao(g: GrupoPorCompetencia) {
    const { competencia, gerenciado } = g;
    // Só os tipos que têm campo na tela entram; o resto segue como está (0 = nada a mudar nesse tipo).
    const ferias = podeEditarTipo(g, "ferias") ? parseInputCurrency(valoresEdicao.ferias) : 0;
    const terco = podeEditarTipo(g, "terco") ? parseInputCurrency(valoresEdicao.terco) : 0;
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
        body: JSON.stringify({ competencia, ferias, terco, gerenciado }),
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

  async function excluir(g: GrupoPorCompetencia) {
    const { competencia, gerenciado } = g;
    const aviso = gerenciado
      ? `Excluir a reserva da Folha lançada em ${competencia}?\n\nO crédito sai do cálculo e deixa de abater a fatura dessa competência (dá pra lançar de novo em "Aplicar", na consulta de reservas).`
      : `Excluir a provisão lançada em ${competencia}?\n\nO valor sai da fatura dessa competência e da provisão acumulada.`;
    if (!confirm(aviso)) return;

    setBusy(true);
    setErro(null);
    try {
      const res = await fetch(`/api/colaboradores/${matricula}/desconto-saldo`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competencia, gerenciado }),
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

  /** Editar/Excluir (ou Salvar/Cancelar) de UM grupo da linha — a provisão lançada e a reserva da Folha têm botões próprios. */
  function acoesDoGrupo(g: GrupoPorCompetencia) {
    if (editando === chaveLinha(g)) {
      return (
        <div key={chaveLinha(g)} className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => salvarEdicao(g)}
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
      );
    }
    return (
      <div key={chaveLinha(g)} className="flex items-center justify-center gap-2">
        {g.gerenciado && <span className="text-xs text-neutral-500">Reserva da Folha</span>}
        <button
          type="button"
          onClick={() => iniciarEdicao(g)}
          disabled={busy}
          className="text-xs font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => excluir(g)}
          disabled={busy}
          className="text-xs font-medium text-red-700 hover:text-red-800 disabled:opacity-50"
        >
          Excluir
        </button>
      </div>
    );
  }

  /** Célula de Prov. Férias / Prov. 13º: o total do mês (Folha + lançado), com o lançado destacado embaixo; em edição, o campo do valor lançado. */
  function celulaProvisao(l: LinhaRescisao, tipo: "ferias" | "terco") {
    const daFolha = tipo === "ferias" ? l.provFerias : l.prov13;
    const lancado = l.lancada?.[tipo] ?? 0;
    if (l.lancada && editando === chaveLinha(l.lancada)) {
      return (
        <div className="flex flex-col items-end gap-0.5">
          <input
            value={valoresEdicao[tipo]}
            onChange={(e) => setValoresEdicao((v) => ({ ...v, [tipo]: e.target.value }))}
            disabled={busy}
            aria-label={tipo === "ferias" ? "Provisão lançada de férias" : "Provisão lançada de 13º salário"}
            className={CLASSE_INPUT}
          />
          {l.temProvisao && <span className="text-[10px] font-sans text-neutral-400">+ Folha {fmt(daFolha)}</span>}
        </div>
      );
    }
    if (!l.temProvisao && lancado === 0) return "—";
    return (
      <div className="flex flex-col items-end">
        <span>{fmt(daFolha + lancado)}</span>
        {lancado > 0 && <span className="text-[10px] font-sans text-emerald-700">inclui {fmt(lancado)} lançado</span>}
      </div>
    );
  }

  /** Célula de (−) Desc. Férias / 13º: o crédito da reserva da Folha, com campo quando ela está em edição. */
  function celulaDesconto(l: LinhaRescisao, tipo: "ferias" | "terco") {
    const valor = l.reserva?.[tipo] ?? 0;
    if (l.reserva && editando === chaveLinha(l.reserva) && podeEditarTipo(l.reserva, tipo)) {
      return (
        <input
          value={valoresEdicao[tipo]}
          onChange={(e) => setValoresEdicao((v) => ({ ...v, [tipo]: e.target.value }))}
          disabled={busy}
          aria-label={tipo === "ferias" ? "Desconto de férias" : "Desconto de 13º salário"}
          className={CLASSE_INPUT}
        />
      );
    }
    return valor > 0 ? fmt(valor) : "—";
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">Rescisão — provisão acumulada</h2>
      <p className="text-xs text-neutral-500">
        Provisão de férias e de 13º mês a mês: a que a Folha (fechamento) gerou pra esse colaborador, somada à que foi lançada no card acima (que
        também é cobrada na fatura do mês), e a provisão de aviso prévio lançada. Os valores vão somando mês a mês. O que a reserva da Folha
        creditou aparece em (−) Desc. e abate do acumulado. O líquido no rodapé é a base pra calcular uma rescisão.
      </p>
      {linhas.length === 0 ? (
        <p className="text-sm text-neutral-400">Nenhuma Folha enviada ainda pra esse colaborador.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Competência</th>
                <th className="px-3 py-2 text-right font-medium">Prov. Férias</th>
                <th className="px-3 py-2 text-right font-medium">Prov. 13º</th>
                <th className="px-3 py-2 text-right font-medium">Prov. Aviso prévio</th>
                <th className="px-3 py-2 text-right font-medium">(−) Desc. Férias</th>
                <th className="px-3 py-2 text-right font-medium">(−) Desc. 13º</th>
                <th className="px-3 py-2 text-center font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {linhas.map((l) => (
                <tr key={l.competencia} className="align-top hover:bg-neutral-50">
                  <td className="px-3 py-2">{l.competencia}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{celulaProvisao(l, "ferias")}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{celulaProvisao(l, "terco")}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {l.aviso ? (
                      <span title={l.aviso.aplicado ? undefined : "Guardado, mas fora da fatura"} className={l.aviso.aplicado ? undefined : "text-neutral-400"}>
                        {fmt(l.aviso.valor)}
                        {l.aviso.aplicado ? "" : " (fora)"}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{celulaDesconto(l, "ferias")}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{celulaDesconto(l, "terco")}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex flex-col gap-1">
                      {l.lancada && acoesDoGrupo(l.lancada)}
                      {l.reserva && acoesDoGrupo(l.reserva)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-300 bg-neutral-50 font-semibold text-neutral-900">
                <td className="px-3 py-2">Subtotal</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(acumuladoFerias)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(acumulado13)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{totalAviso > 0 ? fmt(totalAviso) : "—"}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(totalDescontoFerias)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(totalDesconto13)}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {erro && <p className="text-sm text-red-700">{erro}</p>}

      {linhas.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
          <span>{saldoAposFerias === null ? "Acumulado líquido" : "Saldo de férias após abatimento"}</span>
          <span className="font-mono tabular-nums">
            férias {fmt(saldoAposFerias ?? liquidoFerias)} · 13º {fmt(liquido13)}
            {totalAviso > 0 ? ` · aviso prévio ${fmt(totalAviso)}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}
