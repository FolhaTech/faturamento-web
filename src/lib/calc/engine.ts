import { getColaboradoresPorMatriculas } from "../repo/colaboradores";
import { listEncargos } from "../repo/encargos";
import { listInformativas } from "../repo/informativas";
import { listTomadores } from "../repo/tomadores";
import { normalizaTexto } from "../text";
import type { Colaborador, Encargo, Movimento, TipoEvento, Tomador } from "../types";
import { CODIGO_DESCONTO_SALDO_FERIAS, CODIGO_DESCONTO_SALDO_UM_TERCO } from "./descontoSaldoFerias";

/**
 * Fator de gross-up da nota fiscal: 1 - (PIS 1,65% + COFINS 7,6% + ISS 2% +
 * CSLL 1% + IRRF 1%) = 0,8675. Confirmado batendo com a aba RESUMO do
 * arquivo FATURAMENTO CHAMA (B41 = B40/0,8675 - B40).
 */
export const GROSS_UP_FACTOR = 0.8675;

export interface CalculatedLine {
  matricula: number;
  nome: string;
  codigo: number;
  evento: string;
  competencia: string;
  tipo: TipoEvento;
  tomadorCodigo: number;
  tomadorNome: string;
  trilha: "encargos" | "beneficio" | "excluido";
  dre: number;
  inss: number;
  fgts: number;
  provFerias: number;
  prov13: number;
  /** Encargo trabalhista (INSS) sobre a provisão de férias/13º — mesma alíquota do INSS do evento (655/515). */
  encInss: number;
  /** FGTS sobre a provisão de férias/13º — mesma alíquota de FGTS do evento. */
  encFgts: number;
  base: number;
  taxaAdmValor: number;
  fatura: number;
  impostos: number;
  nf: number;
}

export interface EngineContext {
  encargosPorCodigo: Map<number, Encargo>;
  colaboradoresPorMatricula: Map<number, Colaborador>;
  tomadoresPorCodigo: Map<number, Tomador>;
}

export async function buildContext(movimentos: Movimento[]): Promise<EngineContext> {
  const [encargos, tomadores, colaboradoresPorMatricula] = await Promise.all([
    listEncargos(),
    listTomadores(),
    getColaboradoresPorMatriculas(movimentos.map((m) => m.matricula)),
  ]);
  const encargosPorCodigo = new Map(encargos.map((e) => [e.codigo, e]));
  const tomadoresPorCodigo = new Map(tomadores.map((t) => [t.codigo, t]));
  return { encargosPorCodigo, colaboradoresPorMatricula, tomadoresPorCodigo };
}

function zeroLine(mov: Movimento, tomador: Tomador, trilha: CalculatedLine["trilha"], dre: number, tipo: TipoEvento): CalculatedLine {
  return {
    matricula: mov.matricula,
    nome: mov.nome,
    codigo: mov.codigo,
    evento: mov.evento,
    competencia: mov.competencia,
    tipo,
    tomadorCodigo: tomador.codigo,
    tomadorNome: tomador.nome,
    trilha,
    dre,
    inss: 0,
    fgts: 0,
    provFerias: 0,
    prov13: 0,
    encInss: 0,
    encFgts: 0,
    base: 0,
    taxaAdmValor: 0,
    fatura: 0,
    impostos: 0,
    nf: 0,
  };
}

export interface CalculateResult {
  line: CalculatedLine | null;
  warning: string | null;
}

/**
 * Calcula uma linha de movimento. A trilha de cobrança é decidida pelo Tipo
 * do CÓDIGO cadastrado em Encargos (não pela coluna G do arquivo em si) —
 * a coluna G costuma bater com Encargos, mas quando o sistema de origem
 * marca de forma inconsistente (ex.: "F.G.T.S DO MÊS" às vezes vem como "I"
 * em vez de "FGTS"), confiar nela duplicaria a cobrança: o FGTS daquele mês
 * já está embutido na BASE do provento correspondente (ver mais abaixo). Só
 * cai de volta na coluna G quando o código não está cadastrado em Encargos.
 *
 *  - "P" (provento): cadeia completa DRE -> INSS/FGTS/provisões -> encargo
 *    sobre a provisão, usando a alíquota de Encargos correspondente ao
 *    regime do Tomador (INSS 515 se FPAS 515, INSS 655 se FPAS 655).
 *  - "I" (benefício em espécie / reembolso, ex. vale-refeição fornecido):
 *    cobrado pelo valor de face + taxa administrativa + gross-up de NF, SEM
 *    INSS/FGTS/provisões — benefícios em espécie não geram encargo
 *    trabalhista, mas ainda são um custo real repassado ao cliente.
 *  - "D"/"R" (desconto): é dinheiro retido do HOLERITE do colaborador (INSS
 *    empregado, IRRF, adiantamento, empréstimo consignado, faltas etc.) —
 *    não reduz o custo que a agência cobra do cliente, que continua devendo
 *    o salário bruto + encargos independente do que foi descontado do
 *    empregado. Por isso não entra na soma do faturamento (excluído, igual
 *    FGTS/INSS). "R" é o indicador usado pelo sistema de origem para esse
 *    mesmo tipo de desconto (ex.: faltas).
 *  - "FGTS"/"INSS": linhas de restatement (ex. "F.G.T.S DO MÊS", "I.N.S.S.")
 *    que só reafirmam um valor já refletido nas rubricas de provento do
 *    mesmo colaborador; excluídas para não duplicar a cobrança.
 *
 * Pagamento real de férias OU de 1/3 (código marcado com "Abate saldo" =
 * Férias/1/3 em Encargos): o cliente já vem pagando isso mês a mês como
 * Prov. Férias embutida na BASE dos proventos normais — cobrar o valor
 * cheio de novo cobraria em dobro. `mov.abatimentoFerias` (congelado no
 * upload contra o saldo certo — férias ou 1/3, são saldos separados — ver
 * abatimentoFerias.ts) é subtraído do valor antes de qualquer outro cálculo.
 *
 * Desconto de saldo de férias/1/3 lançado manualmente na tela do colaborador
 * (códigos reservados CODIGO_DESCONTO_SALDO_*, ver descontoSaldoFerias.ts):
 * entra no total INTEGRALMENTE pelo valor exato digitado, sem taxa
 * administrativa nem gross-up de NF — não é um provento normal, é um
 * abatimento direto do que já foi cobrado do tomador.
 */
export function calculateLine(mov: Movimento, ctx: EngineContext): CalculateResult {
  const colaborador = ctx.colaboradoresPorMatricula.get(mov.matricula);
  if (!colaborador) {
    return { line: null, warning: `Matrícula ${mov.matricula} (${mov.nome}) não encontrada em Colaboradores — lançamento "${mov.evento}" ignorado.` };
  }
  if (colaborador.codServico == null) {
    return { line: null, warning: `Colaborador ${mov.matricula} (${mov.nome}) sem Cód Serviço (Tomador) cadastrado — lançamento "${mov.evento}" ignorado.` };
  }
  const tomador = ctx.tomadoresPorCodigo.get(colaborador.codServico);
  if (!tomador) {
    return { line: null, warning: `Tomador cód. ${colaborador.codServico} (colaborador ${mov.matricula}) não encontrado em Tomadores — lançamento "${mov.evento}" ignorado.` };
  }

  if (mov.codigo === CODIGO_DESCONTO_SALDO_FERIAS || mov.codigo === CODIGO_DESCONTO_SALDO_UM_TERCO) {
    const valor = mov.valor;
    return {
      line: { ...zeroLine(mov, tomador, "encargos", valor, mov.tipo), base: valor, fatura: valor, nf: valor },
      warning: null,
    };
  }

  const encargo = ctx.encargosPorCodigo.get(mov.codigo);
  const tipo: TipoEvento = encargo?.tipo ?? mov.tipo;

  const valorAbatido = mov.valor - (mov.abatimentoFerias ?? 0);
  const valorFace = tipo === "D" || tipo === "R" ? -valorAbatido : valorAbatido;

  if (tipo === "FGTS" || tipo === "INSS" || tipo === "D" || tipo === "R") {
    return { line: zeroLine(mov, tomador, "excluido", valorFace, tipo), warning: null };
  }

  if (tipo === "I") {
    const base = valorFace;
    const taxaAdmValor = base * tomador.taxaAdm;
    const fatura = base + taxaAdmValor;
    const nf = fatura / GROSS_UP_FACTOR;
    return {
      line: { ...zeroLine(mov, tomador, "beneficio", valorFace, tipo), base, taxaAdmValor, fatura, impostos: nf - fatura, nf },
      warning: null,
    };
  }

  // tipo "P" -> trilha de encargos
  let warning: string | null = null;
  let inss = 0;
  let fgts = 0;
  let provFerias = 0;
  let prov13 = 0;
  let encInss = 0;
  let encFgts = 0;
  if (!encargo) {
    warning = `Código de evento ${mov.codigo} ("${mov.evento}") não encontrado em Encargos — provento lançado sem encargos adicionais.`;
  } else {
    const inssRate = tomador.fpas === 515 ? encargo.inss515 : encargo.inss655;
    inss = valorFace * inssRate;
    fgts = valorFace * encargo.fgts;
    provFerias = valorFace * encargo.provFerias;
    prov13 = valorFace * encargo.prov13;
    // Regime Temporário (FPAS 655): encargo incide só sobre a provisão de 13º.
    // Regime Terceiro (FPAS 515): incide sobre férias + 13º somados.
    // Mesma alíquota de INSS/FGTS já usada acima para o provento em si —
    // quando férias/13º forem pagos de fato, vão gerar o mesmo encargo.
    const baseEncProv = tomador.fpas === 655 ? prov13 : provFerias + prov13;
    encInss = baseEncProv * inssRate;
    encFgts = baseEncProv * encargo.fgts;
  }

  const base = valorFace + inss + fgts + provFerias + prov13 + encInss + encFgts;
  const taxaAdmValor = base * tomador.taxaAdm;
  const fatura = base + taxaAdmValor;
  const nf = fatura / GROSS_UP_FACTOR;

  return {
    line: {
      matricula: mov.matricula,
      nome: mov.nome,
      codigo: mov.codigo,
      evento: mov.evento,
      competencia: mov.competencia,
      tipo,
      tomadorCodigo: tomador.codigo,
      tomadorNome: tomador.nome,
      trilha: "encargos",
      dre: valorFace,
      inss,
      fgts,
      provFerias,
      prov13,
      encInss,
      encFgts,
      base,
      taxaAdmValor,
      fatura,
      impostos: nf - fatura,
      nf,
    },
    warning,
  };
}

export interface RunResult {
  lines: CalculatedLine[];
  warnings: string[];
}

export async function runEngine(movimentos: Movimento[]): Promise<RunResult> {
  const ctx = await buildContext(movimentos);
  const lines: CalculatedLine[] = [];
  const warnings: string[] = [];

  for (const mov of movimentos) {
    const { line, warning } = calculateLine(mov, ctx);
    if (line) lines.push(line);
    if (warning) warnings.push(warning);
  }

  lines.push(...(await generateComplementaryCharges(movimentos, ctx, warnings)));

  return { lines, warnings };
}

/**
 * Preenche, para cada competência presente em Movimentos, os benefícios de
 * Informativas com "Recorrência = Valor fixo mensal" que os colaboradores
 * ativos *presentes no arquivo daquela competência* deveriam ter mas que
 * não vieram como lançamento (ex.: Ponto Eletrônico, Crachá, ASO — itens
 * cujo código ainda não existe na folha). Cobrados pelo valor de face +
 * taxa administrativa + gross-up, sem INSS/FGTS/provisões. Itens sem valor
 * cadastrado geram um aviso agregado em vez de cobrar R$ 0 silenciosamente.
 *
 * Escopo é "quem está no arquivo do mês", não "todo colaborador ativo no
 * sistema": um upload cobrindo só parte do quadro (ex. um colaborador de
 * teste) não deve gerar cobrança para o resto da empresa.
 */
async function generateComplementaryCharges(movimentos: Movimento[], ctx: EngineContext, warnings: string[]): Promise<CalculatedLine[]> {
  const informativas = await listInformativas();
  const fixas = informativas.filter((i) => normalizaTexto(i.recorrencia ?? "") === normalizaTexto("Valor fixo mensal"));
  if (fixas.length === 0) return [];

  const competencias = [...new Set(movimentos.map((m) => m.competencia))];
  if (competencias.length === 0) return [];

  const semValorAtingiuAlguem = new Set<string>();
  const out: CalculatedLine[] = [];

  for (const competencia of competencias) {
    const jaLancadoPorColaborador = new Map<number, Set<string>>();
    const matriculasDoMes = new Set<number>();
    for (const m of movimentos) {
      if (m.competencia !== competencia) continue;
      matriculasDoMes.add(m.matricula);
      const set = jaLancadoPorColaborador.get(m.matricula) ?? new Set<string>();
      set.add(normalizaTexto(m.evento));
      jaLancadoPorColaborador.set(m.matricula, set);
    }

    const ativosDoMes = [...matriculasDoMes]
      .map((m) => ctx.colaboradoresPorMatricula.get(m))
      .filter((c): c is NonNullable<typeof c> => c != null && c.situacao === "Trabalhando");

    for (const colaborador of ativosDoMes) {
      if (colaborador.codServico == null) continue;
      const tomador = ctx.tomadoresPorCodigo.get(colaborador.codServico);
      if (!tomador) continue;
      const jaLancado = jaLancadoPorColaborador.get(colaborador.matricula) ?? new Set<string>();

      for (const item of fixas) {
        if (jaLancado.has(normalizaTexto(item.evento))) continue; // já veio como lançamento real este mês

        if (item.valor <= 0) {
          semValorAtingiuAlguem.add(item.evento);
          continue;
        }

        const base = item.valor;
        const taxaAdmValor = base * tomador.taxaAdm;
        const fatura = base + taxaAdmValor;
        const nf = fatura / GROSS_UP_FACTOR;
        out.push({
          matricula: colaborador.matricula,
          nome: colaborador.nome,
          codigo: item.codigo ?? -1,
          evento: item.evento,
          competencia,
          tipo: "I",
          tomadorCodigo: tomador.codigo,
          tomadorNome: tomador.nome,
          trilha: "beneficio",
          dre: base,
          inss: 0,
          fgts: 0,
          provFerias: 0,
          prov13: 0,
          encInss: 0,
          encFgts: 0,
          base,
          taxaAdmValor,
          fatura,
          impostos: nf - fatura,
          nf,
        });
      }
    }
  }

  for (const item of fixas) {
    if (item.valor <= 0 && semValorAtingiuAlguem.has(item.evento)) {
      warnings.push(`Benefício "${item.evento}" (Informativas) está com recorrência fixa mas sem valor cadastrado — não foi cobrado de nenhum colaborador.`);
    }
  }

  return out;
}
