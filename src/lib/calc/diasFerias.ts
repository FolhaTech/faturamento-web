import { normalizaTexto } from "../text";
import { mesReserva } from "./reservasFaturadas";

export type DiasGozados = { mes: number; dias: number };

export function hojeSaoPaulo(agora = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

function dataIso(data: string | null): string | null {
  const iso = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(data ?? "");
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(data ?? "");
  const valor = iso?.[1] ?? (br ? br[3] + "-" + br[2] + "-" + br[1] : null);
  if (!valor) return null;
  const d = new Date(valor + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === valor ? valor : null;
}

export function saldoDiasFerias(admissao: string | null, desligamento: string | null, movimentos: DiasGozados[], hoje: string) {
  const inicio = dataIso(admissao);
  const fimVinculo = dataIso(desligamento);
  const fim = fimVinculo && fimVinculo < hoje ? fimVinculo : hoje;
  const mes = mesReserva(fim.slice(5, 7) + "/" + fim.slice(0, 4))!;
  const primeiroMes = inicio ? mesReserva(inicio.slice(5, 7) + "/" + inicio.slice(0, 4))! : null;
  const ultimoDiaMes = new Date(Date.UTC(Number(fim.slice(0, 4)), Number(fim.slice(5, 7)), 0)).getUTCDate();
  const aniversario = inicio ? Math.min(Number(inicio.slice(8, 10)), ultimoDiaMes) : 0;
  const acumulados = primeiroMes === null ? null : Math.max(0, mes - primeiroMes - Number(Number(fim.slice(8, 10)) < aniversario)) * 2.5;
  const historico = movimentos.filter((m) => m.mes <= mes && (primeiroMes === null || m.mes >= primeiroMes));
  const utilizados = historico.reduce((total, m) => total + m.dias, 0);
  return { acumulados, utilizados, saldo: acumulados === null ? null : acumulados - utilizados, historico };
}

export function diasGozadosPorMes(linhas: { competencia: string; evento: string; forma: string | null; ref: number; cadastrado: boolean }[]): DiasGozados[] {
  const porMes = new Map<number, number>();
  for (const l of linhas) {
    const mes = mesReserva(l.competencia);
    if (mes === null || l.competencia.endsWith(" (Prévia)") || !(l.ref > 0 && l.ref <= 31)) continue;
    const evento = normalizaTexto(l.evento);
    if (/\b(ABONO|TERCO|INDENIZAD\w*|PROPORCIONA\w*|VENCID\w*|ADIANTAMENTO|MEDIA\w*|DIFERENCA\w*|ENCARGO\w*)\b|1\s*\/\s*3/.test(evento)) continue;
    const unidade = normalizaTexto(l.forma ?? "");
    const nomeFerias = /^(?:DIAS? (?:DE )?)?FERIAS(?: GOZADAS| NO MES| DO MES)?$/.test(evento);
    if (!l.cadastrado && !nomeFerias) continue;
    if (!/^(D|DIAS?)\.?$/.test(unidade) && (unidade || !nomeFerias)) continue;
    porMes.set(mes, (porMes.get(mes) ?? 0) + l.ref);
  }
  return [...porMes].map(([mes, dias]) => ({ mes, dias })).sort((a, b) => b.mes - a.mes);
}
