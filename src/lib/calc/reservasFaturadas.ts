export const PERIODO_FOLHA = "folha";

export type ReservaTipo = "ferias" | "terco" | "aviso";
export type CobrancaReserva = { mes: number; periodo: string; ferias: number; terco: number; aviso: number };
export type UsoReserva = { mes: number; tipo: ReservaTipo; periodo: string; valor: number; dias: number };

export function mesReserva(competencia: string): number | null {
  const m = /^(0[1-9]|1[0-2])\/(\d{4})(?: \((?:Folha|Prévia)\))?$/.exec(competencia);
  return m ? Number(m[2]) * 12 + Number(m[1]) - 1 : null;
}

export function saldoReserva(cobrancas: CobrancaReserva[], usos: UsoReserva[], mes: number, tipo: ReservaTipo, periodo: string) {
  const inicio = tipo === "aviso" ? mes - 12 : tipo === "terco" ? mes - mes % 12 : -Infinity;
  // Aviso usa os 12 meses fechados anteriores ao desligamento.
  const fim = tipo === "aviso" ? mes - 1 : mes;
  const base = cobrancas.filter((c) => c.mes >= inicio && c.mes <= fim && (tipo !== "ferias" || (periodo === "*" || c.periodo === periodo)));
  const consumos = usos.filter((u) => u.tipo === tipo && u.mes >= inicio && u.mes <= mes && (tipo !== "ferias" || periodo === "*" || !u.periodo || u.periodo === periodo)
    && (tipo !== "terco" || Math.floor(u.mes / 12) === Math.floor(mes / 12)));
  const cobrado = Math.round(base.reduce((s, c) => s + c[tipo], 0));
  const usado = consumos.reduce((s, u) => s + u.valor, 0);
  const dias = tipo === "ferias" ? Math.max(0, base.filter((c) => c.ferias > 0).length * 2.5 - consumos.reduce((s, u) => s + u.dias, 0)) : 0;
  return { cobrado, usado, saldo: Math.max(0, cobrado - usado), dias };
}

export function creditoReserva(saldo: ReturnType<typeof saldoReserva>, dias: number, quitar: boolean): number {
  if (quitar) return saldo.saldo;
  if (dias <= 0 || dias > saldo.dias) return 0;
  return Math.round(saldo.saldo * dias / saldo.dias);
}

export function usosManuais(linhas: { competencia: string; valor: number; tipo: ReservaTipo }[]): UsoReserva[] {
  const porMes = new Map<string, UsoReserva>();
  for (const l of linhas) {
    const mes = mesReserva(l.competencia);
    if (mes === null) continue;
    const chave = mes + ":" + l.tipo;
    const valor = Math.round(Math.abs(l.valor) * 100);
    if ((porMes.get(chave)?.valor ?? 0) < valor) porMes.set(chave, { mes, tipo: l.tipo, periodo: "", valor, dias: 0 });
  }
  return [...porMes.values()];
}
