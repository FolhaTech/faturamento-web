import type { Sql, TransactionSql } from "postgres";
import { ensureSchema, getDb } from "../db";
import { creditoReserva, mesReserva, saldoReserva, usosManuais, type CobrancaReserva, type ReservaTipo, type UsoReserva } from "../calc/reservasFaturadas";

type Uso = UsoReserva & { competencia: string; retirado: boolean };
type Acao = { tipo: "cobranca"; cobranca: Omit<CobrancaReserva, "mes">; referencia: string }
  | { tipo: "aplicar"; reserva: ReservaTipo; periodo: string; dias: number; esperado: number }
  | { tipo: "retirar"; reserva: ReservaTipo };

export class ErroReserva extends Error {}

export async function consultarReservas(matricula: number) {
  await ensureSchema();
  const sql = getDb();
  const [cobrancas, usos, manuais] = await Promise.all([
    sql<(CobrancaReserva & { referencia: string })[]>`SELECT mes, periodo, ferias, terco, aviso, referencia FROM reservas_faturadas WHERE matricula = ${matricula} AND tomador = (SELECT cod_servico FROM colaboradores WHERE matricula = ${matricula}) ORDER BY mes DESC`,
    sql<Uso[]>`SELECT mes, competencia, tipo, periodo, valor, dias, retirado_em IS NOT NULL AS retirado FROM reservas_creditos WHERE matricula = ${matricula} AND tomador = (SELECT cod_servico FROM colaboradores WHERE matricula = ${matricula}) ORDER BY mes DESC, id DESC`,
    listarAbatimentosAnteriores(sql, matricula),
  ]);
  return { cobrancas, usos, manuais: usosManuais(manuais) };
}

export async function alterarReserva(matricula: number, competencia: string, acao: Acao, usuario: string) {
  const mes = mesReserva(competencia);
  if (mes === null || competencia.endsWith(" (Prévia)")) throw new ErroReserva("Competência inválida.");
  await ensureSchema();
  return getDb().begin(async (sql) => {
    const [colaborador] = await sql<{ data_demissao: string | null; cod_servico: number | null }[]>`
      SELECT data_demissao, cod_servico FROM colaboradores WHERE matricula = ${matricula} FOR UPDATE
    `;
    if (!colaborador) throw new ErroReserva("Colaborador não encontrado.");
    const tomador = colaborador.cod_servico;
    if (tomador === null) throw new ErroReserva("Vincule o colaborador a um tomador antes de registrar a reserva.");
    const data = colaborador.data_demissao ?? "";
    const iso = /^(\d{4})-(\d{2})-\d{2}/.exec(data);
    const br = /^\d{2}\/(\d{2})\/(\d{4})$/.exec(data);
    const rescisao = (iso ? mesReserva(iso[2] + "/" + iso[1]) : br ? mesReserva(br[1] + "/" + br[2]) : null) === mes;
    if (acao.tipo === "cobranca") {
      const [posterior] = await sql`SELECT 1 FROM reservas_creditos WHERE matricula = ${matricula} AND tomador = ${tomador} AND mes >= ${mes} AND retirado_em IS NULL LIMIT 1`;
      if (posterior) throw new ErroReserva("Revise os créditos deste mês e dos meses posteriores antes de registrar esta cobrança.");
      const c = acao.cobranca;
      const linhas = await sql`
        INSERT INTO reservas_faturadas (matricula, tomador, mes, periodo, ferias, terco, aviso, referencia, usuario)
        VALUES (${matricula}, ${tomador}, ${mes}, ${c.periodo}, ${c.ferias}, ${c.terco}, ${c.aviso}, ${acao.referencia}, ${usuario})
        ON CONFLICT (matricula, mes) DO NOTHING RETURNING mes
      `;
      if (!linhas.length) throw new ErroReserva("Este mês já tem cobrança confirmada.");
      return;
    }
    const tipo = acao.reserva;
    const existentes = await sql<Uso[]>`SELECT mes, competencia, tipo, periodo, valor, dias, retirado_em IS NOT NULL AS retirado FROM reservas_creditos WHERE matricula = ${matricula} AND tipo = ${tipo} AND tomador = ${tomador} AND retirado_em IS NULL`;
    const atual = existentes.find((u) => u.mes === mes);
    if (atual && atual.competencia !== competencia) throw new ErroReserva("Já existe crédito para este mês na outra competência.");
    if (existentes.some((u) => u.mes > mes)) throw new ErroReserva("Existe crédito posterior desta reserva. Revise-o primeiro.");
    if (acao.tipo === "retirar") {
      await sql`UPDATE reservas_creditos SET retirado_em = now(), retirado_por = ${usuario} WHERE matricula = ${matricula} AND mes = ${mes} AND tipo = ${tipo} AND tomador = ${tomador} AND retirado_em IS NULL`;
      return;
    }
    if (atual) throw new ErroReserva("Retire o crédito atual antes de recalcular.");
    if (tipo === "aviso" && !rescisao) throw new ErroReserva("O aviso prévio exige desligamento cadastrado no mês.");
    if (tipo === "terco" && mes % 12 !== 11 && !rescisao) throw new ErroReserva("O crédito de 13º é aplicado em dezembro ou no mês da rescisão.");
    const cobrancas = await sql<CobrancaReserva[]>`SELECT mes, periodo, ferias, terco, aviso FROM reservas_faturadas WHERE matricula = ${matricula} AND tomador = ${tomador}`;
    const legados = (await listarAbatimentosAnteriores(sql, matricula)).filter((l) => l.tipo === tipo);
    if (legados.some((u) => mesReserva(u.competencia) === mes)) throw new ErroReserva("Já existe abatimento neste mês. Revise-o antes de usar a reserva.");
    if (tipo === "ferias" && !rescisao && acao.periodo === "*") throw new ErroReserva("Selecione um período de férias.");
    const periodo = tipo === "ferias" ? (rescisao ? "*" : acao.periodo) : "";
    if (tipo === "ferias" && existentes.some((u) => u.periodo === "*")) throw new ErroReserva("As férias deste vínculo já foram encerradas em uma rescisão.");
    const saldo = saldoReserva(cobrancas, [...existentes, ...usosManuais(legados)], mes, tipo, periodo);
    const quitar = tipo !== "ferias" || rescisao;
    const valor = creditoReserva(saldo, acao.dias, quitar);
    if (valor !== acao.esperado) throw new ErroReserva("O saldo mudou ou há descontos manuais anteriores. Revise os valores antes de aplicar.");
    if (!valor) throw new ErroReserva("Sem saldo disponível ou dias solicitados acima do saldo do período.");
    const dias = tipo === "ferias" ? (quitar ? saldo.dias : acao.dias) : 0;
    await sql`
      INSERT INTO reservas_creditos (matricula, tomador, mes, competencia, tipo, periodo, valor, dias, usuario)
      VALUES (${matricula}, ${tomador}, ${mes}, ${competencia}, ${tipo}, ${periodo}, ${valor}, ${dias}, ${usuario})
    `;
  });
}

// O fluxo anterior também pode reduzir férias diretamente nas linhas importadas.
// Soma os dois caminhos por competência antes de deduplicar Prévia e Folha.
function listarAbatimentosAnteriores(sql: Sql | TransactionSql, matricula: number) {
  return sql<{ competencia: string; valor: number; tipo: ReservaTipo }[]>`
    SELECT competencia, tipo, SUM(valor)::double precision AS valor FROM (
      SELECT competencia, tipo, ABS(valor) AS valor FROM descontos_saldo
      WHERE matricula = ${matricula} AND aplicado AND valor <> 0
      UNION ALL
      SELECT competencia, 'ferias', ABS(abatimento_ferias) FROM movimentos
      WHERE matricula = ${matricula} AND abatimento_ferias <> 0 AND abatimento_saldo_tipo IN ('ferias', 'terco')
    ) AS abatimentos GROUP BY competencia, tipo
  `;
}
