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

interface DescontoSaldoView {
  competencia: string;
  tipo: "ferias" | "terco";
  valor: number;
  gerenciado?: boolean;
  automatico?: boolean;
}

/** Desconto de aviso prévio lançado numa competência (valor positivo) — aparece na tabela só pra consulta, sem entrar no líquido. */
interface AvisoPrevioView {
  competencia: string;
  valor: number;
  /** false = guardado mas fora da fatura (botão "Não" do aviso prévio no Faturamento). */
  aplicado: boolean;
}

interface DescontoPorCompetencia {
  competencia: string;
  gerenciado: boolean;
  ferias: number;
  terco: number;
}

/** Uma linha da tabela: o mês, a provisão que a Folha gerou nele e os descontos lançados nele (manual e/ou reserva da Folha) e o aviso prévio. */
interface LinhaRescisao {
  competencia: string;
  temProvisao: boolean;
  provFerias: number;
  prov13: number;
  manual: DescontoPorCompetencia | null;
  reserva: DescontoPorCompetencia | null;
  aviso: AvisoPrevioView | null;
}

/** Agrupa os lançamentos (férias e 13º separados) por competência e origem (manual x reserva da Folha), pra editar/excluir cada um sem misturar. */
function agruparDescontosPorCompetencia(descontos: DescontoSaldoView[]): DescontoPorCompetencia[] {
  const porCompetencia = new Map<string, DescontoPorCompetencia>();
  for (const d of descontos) {
    const chave = d.competencia + (d.gerenciado ? ":reserva" : ":manual");
    const linha = porCompetencia.get(chave) ?? { competencia: d.competencia, gerenciado: Boolean(d.gerenciado), ferias: 0, terco: 0 };
    linha[d.tipo] += Math.abs(d.valor);
    porCompetencia.set(chave, linha);
  }
  return [...porCompetencia.values()];
}

/** Identifica um grupo de descontos: a mesma competência pode ter um desconto manual e uma reserva da Folha. */
function chaveLinha(d: DescontoPorCompetencia): string {
  return d.competencia + (d.gerenciado ? ":reserva" : ":manual");
}

/**
 * Junta, numa tabela só, a provisão de cada mês, os descontos lançados nele e o aviso prévio — um mês por linha, mais recente primeiro.
 * Mês que só tem desconto (sem provisão gravada) também ganha linha.
 */
function montarLinhas(provisoes: ProvisaoMensalView[], grupos: DescontoPorCompetencia[], avisos: AvisoPrevioView[]): LinhaRescisao[] {
  const mapa = new Map<string, LinhaRescisao>();
  const linhaDe = (competencia: string): LinhaRescisao => {
    const existente = mapa.get(competencia);
    if (existente) return existente;
    const nova: LinhaRescisao = { competencia, temProvisao: false, provFerias: 0, prov13: 0, manual: null, reserva: null, aviso: null };
    mapa.set(competencia, nova);
    return nova;
  };
  for (const p of provisoes) {
    const l = linhaDe(p.competencia);
    l.temProvisao = true;
    l.provFerias += p.provFerias;
    l.prov13 += p.prov13;
  }
  for (const g of grupos) {
    const l = linhaDe(g.competencia);
    if (g.gerenciado) l.reserva = g;
    else l.manual = g;
  }
  for (const a of avisos) linhaDe(a.competencia).aviso = a;
  return [...mapa.values()].sort((a, b) => (mesReserva(b.competencia) ?? -1) - (mesReserva(a.competencia) ?? -1) || b.competencia.localeCompare(a.competencia));
}

/** O grupo `g` (manual ou reserva) pode editar esse tipo? Reserva só edita o que já tem; manual não edita o tipo que a reserva da Folha já ocupa no mês. */
function podeEditarTipo(g: DescontoPorCompetencia, tipo: "ferias" | "terco", linha: LinhaRescisao): boolean {
  return g.gerenciado ? g[tipo] > 0 : (linha.reserva?.[tipo] ?? 0) === 0;
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
 * Rescisão — provisão acumulada: uma tabela com, mês a mês, o Prov. Férias e o Prov. 13º que a Folha gerou pra esse colaborador (salvos
 * automaticamente a cada Folha enviada, ver provisoesMensais.ts) e, na linha do mês, o que foi lançado como Desconto de férias, de 13º e de
 * aviso prévio (card acima). O líquido no rodapé é a provisão menos os descontos de férias/13º (esse dinheiro já foi quitado — ver
 * descontosSaldo.ts); o aviso prévio é só consulta, não tem provisão pra abater.
 */
export function RescisaoCard({
  matricula,
  provisoes,
  descontos,
  avisos,
  competenciaAtual,
}: {
  matricula: number;
  provisoes: ProvisaoMensalView[];
  descontos: DescontoSaldoView[];
  /** Descontos de aviso prévio lançados (qualquer competência) — coluna só de consulta. */
  avisos: AvisoPrevioView[];
  competenciaAtual: string | null;
}) {
  const router = useRouter();
  const totalProvFerias = provisoes.reduce((soma, p) => soma + p.provFerias, 0);
  const totalProv13 = provisoes.reduce((soma, p) => soma + p.prov13, 0);
  const grupos = agruparDescontosPorCompetencia(descontos);
  const linhas = montarLinhas(provisoes, grupos, avisos);
  const totalDescontoFerias = grupos.reduce((soma, d) => soma + d.ferias, 0);
  const totalDesconto13 = grupos.reduce((soma, d) => soma + d.terco, 0);
  const totalAviso = avisos.reduce((soma, a) => (a.aplicado ? soma + a.valor : soma), 0);
  const liquidoFerias = totalProvFerias - totalDescontoFerias;
  const mesAtual = competenciaAtual ? mesReserva(competenciaAtual) : null;
  const feriasAbatidasNoMes = mesAtual !== null && descontos.some((d) => d.tipo === "ferias" && d.automatico && mesReserva(d.competencia) === mesAtual);
  const saldoAposFerias = feriasAbatidasNoMes
    ? (provisoes.reduce((total, p) => {
        const mes = mesReserva(p.competencia);
        return mes !== null && mes < mesAtual ? total + Math.round(p.provFerias * 100) : total;
      }, 0) - descontos.reduce((total, d) => {
        const mes = mesReserva(d.competencia);
        return d.tipo === "ferias" && mes !== null && mes <= mesAtual ? total + Math.round(Math.abs(d.valor) * 100) : total;
      }, 0)) / 100
    : null;
  const liquido13 = totalProv13 - totalDesconto13;

  const [editando, setEditando] = useState<string | null>(null);
  const [valoresEdicao, setValoresEdicao] = useState<{ ferias: string; terco: string }>({ ferias: "", terco: "" });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function iniciarEdicao(d: DescontoPorCompetencia) {
    setEditando(chaveLinha(d));
    setValoresEdicao({ ferias: inputValue(d.ferias), terco: inputValue(d.terco) });
    setErro(null);
  }

  function cancelarEdicao() {
    setEditando(null);
    setValoresEdicao({ ferias: "", terco: "" });
    setErro(null);
  }

  async function salvarEdicao(d: DescontoPorCompetencia, linha: LinhaRescisao) {
    const { competencia, gerenciado } = d;
    // Só os tipos que têm campo na tela entram; o resto segue como está (0 = nada a mudar nesse tipo).
    const ferias = podeEditarTipo(d, "ferias", linha) ? parseInputCurrency(valoresEdicao.ferias) : 0;
    const terco = podeEditarTipo(d, "terco", linha) ? parseInputCurrency(valoresEdicao.terco) : 0;
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

  async function excluir(d: DescontoPorCompetencia) {
    const { competencia, gerenciado } = d;
    const aviso = gerenciado
      ? `Excluir a reserva da Folha lançada em ${competencia}?\n\nO crédito sai do cálculo e deixa de abater a fatura dessa competência (dá pra lançar de novo em "Aplicar", na consulta de reservas).`
      : `Excluir o desconto lançado em ${competencia}?`;
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

  /** Editar/Excluir (ou Salvar/Cancelar) de UM grupo de descontos da linha — o manual e a reserva da Folha têm botões próprios. */
  function acoesDoGrupo(g: DescontoPorCompetencia, linha: LinhaRescisao) {
    if (editando === chaveLinha(g)) {
      return (
        <div key={chaveLinha(g)} className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => salvarEdicao(g, linha)}
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

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">Rescisão — provisão acumulada</h2>
      <p className="text-xs text-neutral-500">
        Prov. Férias e Prov. 13º que a Folha (fechamento) gerou pra esse colaborador, mês a mês, e na linha do mês o que foi lançado como
        Desconto de férias, de 13º salário e de aviso prévio (esse dinheiro já foi quitado com ele) — salvo sozinho a cada Folha enviada ou
        desconto lançado, sem precisar digitar nada aqui. O líquido no rodapé é a provisão menos os descontos de férias e de 13º e é a base
        pra calcular uma rescisão; o aviso prévio aparece só pra consulta, não entra no líquido.
      </p>
      {linhas.length === 0 ? (
        <p className="text-sm text-neutral-400">Nenhuma Folha enviada ainda pra esse colaborador.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Competência</th>
                <th className="px-3 py-2 text-right font-medium">Prov. Férias</th>
                <th className="px-3 py-2 text-right font-medium">Prov. 13º</th>
                <th className="px-3 py-2 text-right font-medium">(−) Desc. Férias</th>
                <th className="px-3 py-2 text-right font-medium">(−) Desc. 13º</th>
                <th className="px-3 py-2 text-right font-medium">Aviso prévio</th>
                <th className="px-3 py-2 text-center font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {linhas.map((l) => {
                const emEdicao = [l.manual, l.reserva].find((g): g is DescontoPorCompetencia => g !== null && editando === chaveLinha(g)) ?? null;
                const descFerias = (l.manual?.ferias ?? 0) + (l.reserva?.ferias ?? 0);
                const descTerco = (l.manual?.terco ?? 0) + (l.reserva?.terco ?? 0);
                return (
                  <tr key={l.competencia} className="hover:bg-neutral-50">
                    <td className="px-3 py-2">{l.competencia}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{l.temProvisao ? fmt(l.provFerias) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{l.temProvisao ? fmt(l.prov13) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {emEdicao && podeEditarTipo(emEdicao, "ferias", l) ? (
                        <input
                          value={valoresEdicao.ferias}
                          onChange={(e) => setValoresEdicao((v) => ({ ...v, ferias: e.target.value }))}
                          disabled={busy}
                          aria-label="Desconto de férias"
                          className={CLASSE_INPUT}
                        />
                      ) : descFerias > 0 ? (
                        fmt(descFerias)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {emEdicao && podeEditarTipo(emEdicao, "terco", l) ? (
                        <input
                          value={valoresEdicao.terco}
                          onChange={(e) => setValoresEdicao((v) => ({ ...v, terco: e.target.value }))}
                          disabled={busy}
                          aria-label="Desconto de 13º salário"
                          className={CLASSE_INPUT}
                        />
                      ) : descTerco > 0 ? (
                        fmt(descTerco)
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {l.aviso ? (
                        <span title={l.aviso.aplicado ? undefined : "Guardado, mas fora da fatura (Não no Faturamento)"} className={l.aviso.aplicado ? undefined : "text-neutral-400"}>
                          {fmt(l.aviso.valor)}
                          {l.aviso.aplicado ? "" : " (fora)"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex flex-col gap-1">
                        {l.manual && acoesDoGrupo(l.manual, l)}
                        {l.reserva && acoesDoGrupo(l.reserva, l)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-300 bg-neutral-50 font-semibold text-neutral-900">
                <td className="px-3 py-2">Subtotal</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(totalProvFerias)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(totalProv13)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(totalDescontoFerias)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(totalDesconto13)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{totalAviso > 0 ? fmt(totalAviso) : "—"}</td>
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
          </span>
        </div>
      )}
    </div>
  );
}
