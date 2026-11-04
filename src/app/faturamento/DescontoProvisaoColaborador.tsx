"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { creditoReserva, mesReserva, saldoReserva, PERIODO_FOLHA, type ReservaTipo } from "@/lib/calc/reservasFaturadas";
import { hojeSaoPaulo, saldoDiasFerias } from "@/lib/calc/diasFerias";
import type { consultarReservas } from "@/lib/repo/reservasFaturadas";

type Historico = Awaited<ReturnType<typeof consultarReservas>>;
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const valor = (n: number) => moeda.format(n / 100);
const rotulos = { ferias: "Férias + 1/3", terco: "13º salário", aviso: "Aviso prévio" } as const;
const tipos = Object.keys(rotulos) as ReservaTipo[];
const campo = "min-h-11 rounded-md border border-neutral-300 px-2 text-sm";
const botao = "min-h-11 rounded-md border border-neutral-400 px-3 text-sm font-medium hover:bg-neutral-100 disabled:opacity-50";
const exibirMes = (m: number) => String(m % 12 + 1).padStart(2, "0") + "/" + Math.floor(m / 12);

export function DescontoProvisaoColaborador({ matricula, competencia, admissao = null, dataDemissao, consultarSemFolha = false }: { matricula: number; competencia: string | null; admissao?: string | null; dataDemissao?: string | null; consultarSemFolha?: boolean }) {
  const router = useRouter();
  const [dados, setDados] = useState<Historico | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [periodoEscolhido, setPeriodoEscolhido] = useState("");
  const [hoje, setHoje] = useState(hojeSaoPaulo);
  useEffect(() => {
    const timer = window.setInterval(() => setHoje(hojeSaoPaulo()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const diasDaFolha = dados?.diasGozados.find((d) => d.mes === (competencia ? mesReserva(competencia) : null))?.dias ?? 0;
  const mes = competencia ? mesReserva(competencia) : null;
  const podeLancar = mes !== null && !competencia?.endsWith(" (Prévia)");
  if (!podeLancar && !consultarSemFolha) return null;
  const mesDemissao = dataDemissao?.includes("-") ? dataDemissao.slice(5, 7) + "/" + dataDemissao.slice(0, 4) : dataDemissao?.slice(3);
  const rescisao = mes !== null && mesDemissao === exibirMes(mes);
  const periodos = [...new Set(dados?.cobrancas.filter((c) => mes !== null && c.mes <= mes && c.ferias > 0).map((c) => c.periodo))];
  const periodo = periodoEscolhido || (periodos.includes(PERIODO_FOLHA) ? PERIODO_FOLHA : periodos[0] ?? "");
  const saldoDias = dados ? saldoDiasFerias(admissao, dataDemissao ?? null, dados.diasGozados, hoje) : null;
  const endpoint = "/api/faturamento/desconto-provisao";

  async function atualizar(body?: Record<string, unknown>) {
    setOcupado(true);
    setErro("");
    try {
      const resposta = await fetch(body ? endpoint : endpoint + "?matricula=" + matricula, body ? {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, matricula, competencia }),
      } : undefined);
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.error ?? "Não foi possível consultar o histórico.");
      setDados(resultado);
      if (body) router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao consultar as reservas.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-900">
      <h4 className="font-semibold">Reservas cobradas e abatimentos</h4>
      {!dados && <button type="button" className={botao} disabled={ocupado} onClick={() => atualizar()}>Consultar reservas</button>}
      {dados && <>
        {saldoDias && consultarSemFolha && <div className="space-y-2 rounded border border-neutral-200 p-3">
          <h5 className="font-medium">Dias de férias até {hoje.split("-").reverse().join("/")}</h5>
          <dl className="grid gap-2 sm:grid-cols-3">
            <div><dt>Acumulados</dt><dd className="font-semibold">{saldoDias.acumulados?.toLocaleString("pt-BR") ?? "Admissão não informada"}</dd></div>
            <div><dt>Gozados na Folha</dt><dd className="font-semibold">{saldoDias.utilizados.toLocaleString("pt-BR")}</dd></div>
            <div><dt>Saldo em dias</dt><dd className="font-semibold">{saldoDias.saldo?.toLocaleString("pt-BR") ?? "—"}</dd></div>
          </dl>
          <p className="text-neutral-600">2,5 dias por mês completo desde a admissão, até o desligamento quando houver.</p>
          {saldoDias.historico.length > 0 && <details>
            <summary className="cursor-pointer py-2">Dias gozados por competência</summary>
            <ul>{saldoDias.historico.map((d) => <li key={d.mes}>{exibirMes(d.mes)} · {d.dias.toLocaleString("pt-BR")} dias</li>)}</ul>
          </details>}
        </div>}
        {mes === null ? <p className="text-neutral-600">Selecione uma competência de Folha para lançar créditos.</p> : <>
          <p className="text-neutral-600">Férias e 13º vêm das provisões da Folha e consideram os abatimentos já registrados. O aviso prévio usa o histórico de faturas salvas. O crédito aplicado entra no cálculo ao vivo; versões salvas precisam ser atualizadas.</p>
          {!podeLancar && <p className="text-neutral-600">Selecione uma competência de Folha para lançar créditos.</p>}
          <div className="grid gap-3 lg:grid-cols-3">
            {tipos.map((tipo) => {
              const atual = dados.usos.find((u) => u.tipo === tipo && u.mes === mes && !u.retirado);
              const periodoAplicado = tipo === "ferias" && rescisao ? "*" : periodo;
              const saldo = saldoReserva(dados.cobrancas, [...dados.usos.filter((u) => !u.retirado), ...dados.manuais], mes, tipo, periodoAplicado);
              const manual = dados.manuais.some((u) => u.tipo === tipo && u.mes === mes);
              const quitar = tipo !== "ferias" || rescisao;
              const sugestao = creditoReserva(saldo, diasDaFolha, quitar);
              const elegivel = tipo === "ferias" || rescisao || (tipo === "terco" && mes % 12 === 11);
              return <div className="space-y-2 rounded border border-neutral-200 p-3" key={tipo}>
                <h5 className="font-medium">{rotulos[tipo]}</h5>
                {tipo === "ferias" && rescisao && <p>Quitação dos períodos de férias deste vínculo.</p>}
                {tipo === "ferias" && !rescisao && <>
                  <label className="flex flex-col gap-1">Período de férias
                    <select className={campo} value={periodo} onChange={(e) => setPeriodoEscolhido(e.target.value)}>
                      {periodos.length === 0 && <option value="">Sem provisões de férias</option>}
                      {periodos.map((p) => <option key={p} value={p}>{p === PERIODO_FOLHA ? "Histórico da Folha" : p}</option>)}
                    </select>
                  </label>
                  {!quitar && <p>Dias gozados na Folha de {exibirMes(mes)}: <strong>{diasDaFolha.toLocaleString("pt-BR")}</strong></p>}
                </>}
                {tipo === "aviso" && <p>De {exibirMes(mes - 12)} a {exibirMes(mes - 1)}.</p>}
                {tipo === "terco" && <p>Exercício de {Math.floor(mes / 12)}.</p>}
                <p>Cobrado: {valor(saldo.cobrado)} · Usado: {valor(saldo.usado)}</p>
                <p>Saldo: <strong>{valor(saldo.saldo)}</strong></p>
                {atual ? <>
                  <p>Crédito em {atual.competencia}: <strong>{valor(atual.valor)}</strong></p>
                  {podeLancar && atual.competencia === competencia && <button type="button" className={botao} disabled={ocupado} onClick={() => atualizar({ tipo: "retirar", reserva: tipo })}>Retirar crédito</button>}
                </> : <>
                  {manual && <p>Já há um abatimento neste mês.</p>}
                  {!elegivel && <p>{tipo === "aviso" ? "Disponível no mês do desligamento." : "Disponível em dezembro ou na rescisão."}</p>}
                  {podeLancar && <button type="button" className={botao} disabled={ocupado || manual || !elegivel || sugestao <= 0} onClick={() => atualizar({ tipo: "aplicar", reserva: tipo, periodo: periodoAplicado, esperado: sugestao })}>Aplicar {valor(sugestao)}</button>}
                </>}
              </div>;
            })}
          </div>
        </>}
        <details open={mes === null ? true : undefined}>
          <summary className="cursor-pointer py-2 font-medium">Histórico de cobranças e créditos</summary>
          <ul className="space-y-1">
            {dados.cobrancas.map((c) => <li key={c.mes}>{exibirMes(c.mes)} · {c.referencia} · Férias {valor(c.ferias)}{c.periodo && c.periodo !== PERIODO_FOLHA && " (" + c.periodo + ")"} · 13º {valor(c.terco)} · Aviso {valor(c.aviso)}</li>)}
            {dados.usos.map((u, i) => <li key={i}>{u.competencia} · {u.retirado ? "Crédito retirado" : "Crédito"} de {rotulos[u.tipo]}: {valor(u.valor)}{u.periodo && " · " + (u.periodo === "*" ? "Rescisão" : u.periodo === PERIODO_FOLHA ? "Histórico da Folha" : u.periodo) + " · " + u.dias + " dias"}</li>)}
            {dados.manuais.map((u) => <li key={u.mes + ":" + u.tipo}>{exibirMes(u.mes)} · Abatimento anterior de {rotulos[u.tipo]}: {valor(u.valor)}</li>)}
            {!dados.cobrancas.length && !dados.usos.length && !dados.manuais.length && <li>Nenhum registro confirmado.</li>}
          </ul>
        </details>
      </>}
      {ocupado && <p role="status">Atualizando reservas…</p>}
      {erro && <p role="alert" className="text-red-700">{erro}</p>}
    </div>
  );
}
