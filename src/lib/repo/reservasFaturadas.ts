import { hojeSaoPaulo, saldoDiasFerias } from "../calc/diasFerias";
import type { Sql, TransactionSql } from "postgres";
import { CODIGO_AVISO_PREVIO } from "../calc/engine";
import { getColaboradoresPorMatriculas } from "./colaboradores";
import { listarDiasGozados } from "./diasFerias";
import { ensureSchema, getDb } from "../db";
import { baseFeriasGozadas, creditoReserva, mesReserva, saldoReserva, usosManuais, PERIODO_FOLHA, ORIGEM_FERIAS_AUTOMATICAS, type CobrancaReserva, type ReservaTipo, type UsoReserva } from "../calc/reservasFaturadas";

type Uso = UsoReserva & { competencia: string; retirado: boolean; automatico: boolean };
type Acao = { tipo: "cobranca"; cobranca: Omit<CobrancaReserva, "mes">; referencia: string }
  | { tipo: "aplicar"; reserva: ReservaTipo; periodo: string; esperado: number }
  | { tipo: "retirar"; reserva: ReservaTipo };

export class ErroReserva extends Error {}

export async function lancarDiasGozados(matricula: number, competencia: string, dias: number, usuario: string, chave: string, substituirId: string | null = null) {
  const mes = mesReserva(competencia);
  if (mes === null || !competencia.endsWith(" (Folha)")) throw new ErroReserva("Selecione uma competência de Folha.");
  await ensureSchema();
  const deveSincronizar = await getDb().begin(async (sql) => {
    const [colaborador] = await sql`SELECT 1 FROM colaboradores WHERE matricula = ${matricula} FOR UPDATE`;
    if (!colaborador) throw new ErroReserva("Colaborador não encontrado.");
    const [posterior] = await sql`SELECT 1 FROM reservas_creditos WHERE matricula = ${matricula} AND tipo = 'ferias' AND mes > ${mes} AND retirado_em IS NULL LIMIT 1`;
    const [folhaImportada] = await sql`SELECT 1 FROM movimentos WHERE matricula = ${matricula} AND competencia = ${competencia} LIMIT 1`;
    const sincronizar = Boolean(folhaImportada) && !posterior;
    const [existente] = await sql<{ matricula: number; mes: number; dias: number; substituiId: string | null }[]>`SELECT matricula, mes, dias, substitui_id::text AS "substituiId" FROM dias_ferias_informados WHERE chave = ${chave}`;
    if (existente) {
      if (existente.matricula !== matricula || existente.mes !== mes || existente.dias !== dias || existente.substituiId !== substituirId) throw new ErroReserva("Este lançamento já foi usado com outros valores.");
      return sincronizar;
    }
    let diasAnteriores = 0;
    let modo = "adicionar";
    if (substituirId !== null) {
      const [anterior] = await sql<{ dias: number; modo: string }[]>`
        SELECT d.dias, d.modo FROM dias_ferias_informados d
        WHERE d.id = ${substituirId} AND d.matricula = ${matricula} AND d.mes = ${mes} AND d.modo IN ('adicionar', 'substituir') AND d.dias IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM dias_ferias_informados r WHERE r.substitui_id = d.id)
          AND (d.modo <> 'substituir' OR NOT EXISTS (
            SELECT 1 FROM dias_ferias_informados r WHERE r.matricula = d.matricula AND r.mes = d.mes AND r.modo = 'substituir' AND r.id > d.id
          ))
      `;
      if (!anterior) throw new ErroReserva("O lançamento já foi corrigido ou não pertence a este colaborador. Atualize a consulta.");
      diasAnteriores = anterior.dias;
      modo = anterior.modo;
    }
    const acumulado = (await listarDiasGozados([matricula], sql)).get(matricula)?.find((d) => d.mes === mes)?.dias ?? 0;
    if (acumulado - diasAnteriores + dias > 31) throw new ErroReserva("O total de dias gozados nesta competência não pode ultrapassar 31.");
    await sql`INSERT INTO dias_ferias_informados (matricula, mes, dias, usuario, modo, chave, substitui_id) VALUES (${matricula}, ${mes}, ${dias}, ${usuario}, ${modo}, ${chave}, ${substituirId})`;
    return sincronizar;
  });
  if (deveSincronizar) await sincronizarCreditosFeriasDaFolha(competencia, [matricula]);
}

export async function consultarReservas(matricula: number) {
  await ensureSchema();
  const sql = getDb();
  const [cobrancas, usos, manuais, diasGozados, lancamentosDias] = await Promise.all([
    listarBaseReservas(sql, matricula),
    sql<Uso[]>`SELECT mes, competencia, tipo, periodo, valor, dias, retirado_em IS NOT NULL AS retirado, usuario = ${ORIGEM_FERIAS_AUTOMATICAS} AS automatico FROM reservas_creditos WHERE matricula = ${matricula} AND tomador = (SELECT cod_servico FROM colaboradores WHERE matricula = ${matricula}) ORDER BY mes DESC, id DESC`,
    listarAbatimentosAnteriores(sql, matricula),
    listarDiasGozados([matricula], sql),
    sql<{ id: string; mes: number; dias: number; usuario: string; registradoEm: string; corrigido: boolean }[]>`
      SELECT d.id::text, d.mes, d.dias, d.usuario, d.registrado_em::text AS "registradoEm",
        (EXISTS (SELECT 1 FROM dias_ferias_informados r WHERE r.substitui_id = d.id)
          OR (d.modo = 'substituir' AND EXISTS (
            SELECT 1 FROM dias_ferias_informados r WHERE r.matricula = d.matricula AND r.mes = d.mes AND r.modo = 'substituir' AND r.id > d.id
          ))) AS corrigido
      FROM dias_ferias_informados d WHERE d.matricula = ${matricula} AND d.modo IN ('adicionar', 'substituir') AND d.dias IS NOT NULL ORDER BY d.mes DESC, d.id DESC
    `,
  ]);
  return { cobrancas, usos, manuais: usosManuais(manuais), diasGozados: diasGozados.get(matricula) ?? [], lancamentosDias };
}

export async function alterarReserva(matricula: number, competencia: string, acao: Acao, usuario: string) {
  const mes = mesReserva(competencia);
  if (mes === null || competencia.endsWith(" (Prévia)")) throw new ErroReserva("Competência inválida.");
  await ensureSchema();
  return getDb().begin(async (sql) => {
    const [colaborador] = await sql<{ admissao: string | null; data_demissao: string | null; cod_servico: number | null }[]>`
      SELECT admissao, data_demissao, cod_servico FROM colaboradores WHERE matricula = ${matricula} FOR UPDATE
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
    const existentes = await sql<Uso[]>`SELECT mes, competencia, tipo, periodo, valor, dias, retirado_em IS NOT NULL AS retirado, usuario = ${ORIGEM_FERIAS_AUTOMATICAS} AS automatico FROM reservas_creditos WHERE matricula = ${matricula} AND tipo = ${tipo} AND tomador = ${tomador} AND retirado_em IS NULL`;
    const atual = existentes.find((u) => u.mes === mes);
    if (atual && atual.competencia !== competencia) throw new ErroReserva("Já existe crédito para este mês na outra competência.");
    if (existentes.some((u) => u.mes > mes)) throw new ErroReserva("Existe crédito posterior desta reserva. Revise-o primeiro.");
    if (acao.tipo === "retirar") {
      if (atual?.automatico) throw new ErroReserva("O crédito automático segue os dias de férias da Folha.");
      await sql`UPDATE reservas_creditos SET retirado_em = now(), retirado_por = ${usuario} WHERE matricula = ${matricula} AND mes = ${mes} AND tipo = ${tipo} AND tomador = ${tomador} AND retirado_em IS NULL`;
      return;
    }
    if (atual) throw new ErroReserva("Retire o crédito atual antes de recalcular.");
    if (tipo === "aviso" && !rescisao) throw new ErroReserva("O aviso prévio exige desligamento cadastrado no mês.");
    if (tipo === "terco" && mes % 12 !== 11 && !rescisao) throw new ErroReserva("O crédito de 13º é aplicado em dezembro ou no mês da rescisão.");
    const cobrancas = await listarBaseReservas(sql, matricula);
    const legados = (await listarAbatimentosAnteriores(sql, matricula)).filter((l) => l.tipo === tipo);
    if (legados.some((u) => mesReserva(u.competencia) === mes)) throw new ErroReserva("Já existe abatimento neste mês. Revise-o antes de usar a reserva.");
    if (tipo === "ferias" && !rescisao && acao.periodo === "*") throw new ErroReserva("Selecione um período de férias.");
    const periodo = tipo === "ferias" ? (rescisao ? "*" : acao.periodo) : "";
    if (tipo === "ferias" && existentes.some((u) => u.periodo === "*")) throw new ErroReserva("As férias deste vínculo já foram encerradas em uma rescisão.");
    const quitar = tipo !== "ferias" || rescisao;
    const usos = [...existentes, ...usosManuais(legados)];
    const saldo = quitar
      ? saldoReserva(cobrancas, usos, mes, tipo, periodo)
      : baseFeriasGozadas(cobrancas, usos, mes, periodo, saldoDiasFerias(colaborador.admissao, colaborador.data_demissao, [], hojeSaoPaulo()).acumulados ?? 0);
    const diasDaFolha = tipo === "ferias" && !quitar
      ? (await listarDiasGozados([matricula], sql)).get(matricula)?.find((d) => d.mes === mes)?.dias ?? 0
      : 0;
    const valor = creditoReserva(saldo, diasDaFolha, quitar);
    if (valor !== acao.esperado) throw new ErroReserva("O saldo mudou ou há descontos manuais anteriores. Revise os valores antes de aplicar.");
    if (!valor) throw new ErroReserva("Sem saldo disponível ou dias solicitados acima do saldo do período.");
    const dias = tipo === "ferias" ? (quitar ? saldo.dias : diasDaFolha) : 0;
    await sql`
      INSERT INTO reservas_creditos (matricula, tomador, mes, competencia, tipo, periodo, valor, dias, usuario)
      VALUES (${matricula}, ${tomador}, ${mes}, ${competencia}, ${tipo}, ${periodo}, ${valor}, ${dias}, ${usuario})
    `;
  });
}

const ROTULO_CREDITO = { ferias: "Férias", terco: "13º" } as const;

/**
 * Edita os créditos de reserva (linha "Reserva da Folha" da Rescisão — ver RescisaoCard.tsx) lançados numa competência: `valores` traz o
 * novo valor em reais (positivo) de Férias e/ou 13º. Valor igual ao atual não muda nada; 0 exclui o crédito (ver excluirCreditosReserva);
 * valor positivo onde não há crédito é erro (aqui só se corrige o que já existe). É uma correção manual, sem as travas do fluxo de
 * "Aplicar": vale o que a pessoa digitou. Um crédito automático editado segue com o valor digitado enquanto os dias gozados da Folha
 * não mudarem — se mudarem, o sincronismo recalcula o crédito a partir deles.
 */
export async function editarCreditosReserva(matricula: number, competencia: string, valores: Partial<Record<"ferias" | "terco", number>>, usuario: string): Promise<void> {
  await ensureSchema();
  await getDb().begin(async (sql) => {
    const [colaborador] = await sql<{ cod_servico: number | null }[]>`SELECT cod_servico FROM colaboradores WHERE matricula = ${matricula} FOR UPDATE`;
    if (!colaborador) throw new ErroReserva("Colaborador não encontrado.");
    const tomador = colaborador.cod_servico;
    if (tomador === null) throw new ErroReserva("Vincule o colaborador a um tomador antes de editar a reserva.");
    for (const tipo of ["ferias", "terco"] as const) {
      const novo = valores[tipo];
      if (novo === undefined) continue;
      const centavos = Math.round(novo * 100);
      const [atual] = await sql<{ id: string; valor: number }[]>`
        SELECT id, valor FROM reservas_creditos
        WHERE matricula = ${matricula} AND competencia = ${competencia} AND tipo = ${tipo} AND tomador = ${tomador} AND retirado_em IS NULL
      `;
      if (!atual) {
        if (centavos > 0) throw new ErroReserva(`Não há crédito de ${ROTULO_CREDITO[tipo]} em ${competencia} para editar.`);
        continue;
      }
      if (centavos === atual.valor) continue;
      if (centavos <= 0) {
        await sql`UPDATE reservas_creditos SET retirado_em = now(), retirado_por = ${usuario} WHERE id = ${atual.id}`;
      } else {
        await sql`UPDATE reservas_creditos SET valor = ${centavos} WHERE id = ${atual.id}`;
      }
    }
  });
}

/**
 * Exclui (retira) os créditos de reserva de Férias e 13º lançados numa competência — a linha "Reserva da Folha" da Rescisão. O crédito
 * automático excluído por uma pessoa não volta sozinho a cada Folha carregada (ver o sincronismo abaixo); dá pra lançar de novo pelo
 * "Aplicar" da consulta de reservas. Os descontos manuais da mesma competência não são tocados. Erro quando não há crédito ativo.
 */
export async function excluirCreditosReserva(matricula: number, competencia: string, usuario: string): Promise<void> {
  await ensureSchema();
  const retirados = await getDb()`
    UPDATE reservas_creditos SET retirado_em = now(), retirado_por = ${usuario}
    WHERE matricula = ${matricula} AND competencia = ${competencia} AND tipo IN ('ferias', 'terco') AND retirado_em IS NULL
      AND tomador = (SELECT cod_servico FROM colaboradores WHERE matricula = ${matricula})
    RETURNING id
  `;
  if (retirados.length === 0) throw new ErroReserva(`Não há reserva da Folha ativa em ${competencia} para excluir.`);
}

export async function sincronizarCreditosFeriasDaFolha(competencia: string, matriculas: number[]) {
  const mes = mesReserva(competencia);
  if (mes === null || !competencia.endsWith(" (Folha)")) return;
  await ensureSchema();
  const sql = getDb();
  const [diasPorMatricula, ativos] = await Promise.all([
    listarDiasGozados(matriculas, sql),
    sql<{ matricula: number }[]>`
      SELECT matricula FROM reservas_creditos
      WHERE competencia = ${competencia} AND tipo = 'ferias' AND usuario = ${ORIGEM_FERIAS_AUTOMATICAS} AND retirado_em IS NULL
    `,
  ]);
  const diasDoMes = new Map([...diasPorMatricula].map(([matricula, dias]) => [matricula, dias.find((d) => d.mes === mes)?.dias ?? 0]));
  const candidatas = [...new Set([...ativos.map((a) => a.matricula), ...matriculas.filter((m) => diasDoMes.get(m))])];
  if (!candidatas.length) return;
  const colaboradores = await getColaboradoresPorMatriculas(candidatas);

  for (const matricula of candidatas) {
    const colaborador = colaboradores.get(matricula);
    const tomador = colaborador?.codServico;
    if (!colaborador || tomador == null) continue;
    await sql.begin(async (tx) => {
      await tx`SELECT 1 FROM colaboradores WHERE matricula = ${matricula} FOR UPDATE`;
      const [atual] = await tx<{ id: string; usuario: string; dias: number }[]>`
        SELECT id, usuario, dias FROM reservas_creditos
        WHERE matricula = ${matricula} AND mes = ${mes} AND tipo = 'ferias' AND retirado_em IS NULL
      `;
      if (atual && atual.usuario !== ORIGEM_FERIAS_AUTOMATICAS) return;
      // Crédito automático que uma pessoa excluiu (ver excluirCreditosReserva) não é recriado a cada Folha carregada: quem retira
      // por conta própria grava o próprio nome em retirado_por; as retiradas do sincronismo gravam ORIGEM_FERIAS_AUTOMATICAS.
      const [excluidoPorPessoa] = await tx`
        SELECT 1 FROM reservas_creditos
        WHERE matricula = ${matricula} AND mes = ${mes} AND tipo = 'ferias' AND usuario = ${ORIGEM_FERIAS_AUTOMATICAS}
          AND retirado_em IS NOT NULL AND retirado_por <> ${ORIGEM_FERIAS_AUTOMATICAS}
        LIMIT 1
      `;
      if (excluidoPorPessoa) return;
      const dias = (await listarDiasGozados([matricula], tx)).get(matricula)?.find((d) => d.mes === mes)?.dias ?? 0;
      // O abatimento aplicado dentro do próprio evento da Folha já reduz a fatura.
      const [abatimentoNaLinha] = await tx`
        SELECT 1 FROM movimentos
        WHERE matricula = ${matricula} AND competencia = ${competencia} AND abatimento_ferias > 0
        LIMIT 1
      `;
      if (atual && dias === atual.dias && !abatimentoNaLinha) return;
      if (atual) {
        await tx`UPDATE reservas_creditos SET retirado_em = now(), retirado_por = ${ORIGEM_FERIAS_AUTOMATICAS} WHERE id = ${atual.id}`;
      }
      if (!dias || abatimentoNaLinha) return;

      const [cobrancas, anteriores, legados] = await Promise.all([
        listarBaseReservas(tx, matricula),
        tx<UsoReserva[]>`
          SELECT mes, tipo, periodo, valor, dias FROM reservas_creditos
          WHERE matricula = ${matricula} AND tomador = ${tomador} AND tipo = 'ferias' AND mes < ${mes} AND retirado_em IS NULL
        `,
        listarAbatimentosAnteriores(tx, matricula),
      ]);
      if (anteriores.some((u) => u.periodo === "*")) return;
      const periodos = cobrancas.filter((c) => c.mes < mes && c.ferias > 0).map((c) => c.periodo);
      const periodo = periodos.includes(PERIODO_FOLHA) ? PERIODO_FOLHA : periodos[0];
      if (!periodo) return;
      const acumulados = saldoDiasFerias(colaborador.admissao, colaborador.dataDemissao, [], hojeSaoPaulo()).acumulados ?? 0;
      const base = baseFeriasGozadas(cobrancas, [...anteriores, ...usosManuais(legados)], mes, periodo, acumulados);
      const valor = creditoReserva(base, dias, false);
      if (valor <= 0) return;
      await tx`
        INSERT INTO reservas_creditos (matricula, tomador, mes, competencia, tipo, periodo, valor, dias, usuario)
        VALUES (${matricula}, ${tomador}, ${mes}, ${competencia}, 'ferias', ${periodo}, ${valor}, ${dias}, ${ORIGEM_FERIAS_AUTOMATICAS})
      `;
    });
  }
}

// O fluxo anterior também pode reduzir férias diretamente nas linhas importadas (abatimento gravado no upload da Folha). Os valores lançados à
// mão na ficha do colaborador NÃO entram aqui: viraram provisão lançada (ver listarBaseReservas), que soma no cobrado em vez de abater.
function listarAbatimentosAnteriores(sql: Sql | TransactionSql, matricula: number) {
  return sql<{ competencia: string; valor: number; tipo: ReservaTipo }[]>`
    SELECT competencia, 'ferias' AS tipo, SUM(ABS(abatimento_ferias))::double precision AS valor FROM movimentos
    WHERE matricula = ${matricula} AND abatimento_ferias <> 0 AND abatimento_saldo_tipo IN ('ferias', 'terco')
    GROUP BY competencia
  `;
}

async function listarBaseReservas(sql: Sql | TransactionSql, matricula: number) {
  const [confirmadas, provisoes, avisos, lancadas] = await Promise.all([
    sql<(CobrancaReserva & { referencia: string })[]>`
      SELECT mes, periodo, ferias, terco, aviso, referencia FROM reservas_faturadas
      WHERE matricula = ${matricula} AND tomador = (SELECT cod_servico FROM colaboradores WHERE matricula = ${matricula})
    `,
    sql<{ competencia: string; prov_ferias: number; prov_13: number }[]>`
      SELECT competencia, prov_ferias, prov_13 FROM provisoes_mensais
      WHERE matricula = ${matricula}
      ORDER BY (competencia LIKE '% (Folha)') DESC, salvo_em DESC
    `,
    sql<{ competencia: string; aviso: number }[]>`
      WITH fechamentos AS (
        SELECT DISTINCT ON (left(competencia, 7)) competencia, lines
        FROM faturas_salvas
        WHERE NOT descartada AND competencia NOT LIKE '% (Prévia)'
        ORDER BY left(competencia, 7), (competencia LIKE '% (Folha)') DESC, salvo_em DESC, id DESC
      )
      SELECT f.competencia, SUM((item->>'base')::double precision) AS aviso
      FROM fechamentos f CROSS JOIN LATERAL jsonb_array_elements(f.lines::jsonb) AS item
      WHERE item->>'codigo' = ${String(CODIGO_AVISO_PREVIO)}
        AND item->>'matricula' = ${String(matricula)}
        AND item->>'tomadorCodigo' = (SELECT cod_servico::text FROM colaboradores WHERE matricula = ${matricula})
      GROUP BY f.competencia
    `,
    // Provisões lançadas à mão na ficha do colaborador (férias, 13º, aviso prévio): valem no lugar das da Folha no mês (ver abaixo).
    sql<{ competencia: string; tipo: ReservaTipo; valor: number }[]>`
      SELECT competencia, tipo, SUM(ABS(valor))::double precision AS valor FROM descontos_saldo
      WHERE matricula = ${matricula} AND aplicado AND valor <> 0
      GROUP BY competencia, tipo
    `,
  ]);
  const porMes = new Map(confirmadas.map((c) => [c.mes, c]));
  const mesesDaFolha = new Set<number>();
  for (const p of provisoes) {
    const mes = mesReserva(p.competencia);
    if (mes === null || p.competencia.endsWith(" (Prévia)") || mesesDaFolha.has(mes)) continue;
    mesesDaFolha.add(mes);
    const confirmada = porMes.get(mes);
    porMes.set(mes, {
      mes,
      periodo: confirmada?.periodo || PERIODO_FOLHA,
      ferias: Math.round(p.prov_ferias * 100),
      terco: p.prov_13 * 100,
      aviso: confirmada?.aviso ?? 0,
      referencia: confirmada?.aviso ? "Folha · aviso: " + confirmada.referencia : "Provisões da Folha",
    });
  }
  for (const a of avisos) {
    const mes = mesReserva(a.competencia);
    if (mes === null) continue;
    const base = porMes.get(mes);
    if (base?.aviso) continue;
    porMes.set(mes, {
      ...(base ?? { mes, periodo: "", ferias: 0, terco: 0 }),
      aviso: a.aviso * 100,
      referencia: base ? base.referencia + " · aviso da fatura salva" : "Aviso da fatura salva",
    });
  }
  // Provisão lançada à mão: vale NO LUGAR do que a Folha provisionou naquele mês e tipo (mesma regra da Rescisão — provisão acumulada).
  // Prévia e Folha do mesmo mês não se somam (vale o maior), como nos abatimentos.
  const lancadoPorMesETipo = new Map<string, { mes: number; tipo: ReservaTipo; centavos: number }>();
  for (const l of lancadas) {
    const mes = mesReserva(l.competencia);
    if (mes === null) continue;
    const chave = mes + ":" + l.tipo;
    const centavos = Math.round(l.valor * 100);
    if ((lancadoPorMesETipo.get(chave)?.centavos ?? 0) < centavos) lancadoPorMesETipo.set(chave, { mes, tipo: l.tipo, centavos });
  }
  for (const { mes, tipo, centavos } of lancadoPorMesETipo.values()) {
    const base = porMes.get(mes);
    const novo = { ...(base ?? { mes, periodo: PERIODO_FOLHA, ferias: 0, terco: 0, aviso: 0, referencia: "" }) };
    novo.periodo = novo.periodo || PERIODO_FOLHA;
    novo[tipo] = centavos;
    novo.referencia = novo.referencia ? novo.referencia + " · provisão lançada" : "Provisão lançada";
    porMes.set(mes, novo);
  }
  return [...porMes.values()].sort((a, b) => b.mes - a.mes);
}
