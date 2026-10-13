import type { CcustoResumo, RubricaSomada } from "../calc/aggregate";
import { formatarDataBr } from "../dataBr";
import { calcularRetencoesSobreCobrado } from "../calc/retencoesCobranca";
import { calcularCobranca, somarCobranca, type DeducaoColaborador } from "../percentualCobranca";
import { normalizaTexto } from "../text";

/**
 * Modelo único do relatório de Faturamento: o PDF, o Word e o Excel mostram as MESMAS informações (resumo, detalhamento
 * por evento, descontos e linhas informativas, detalhamento por colaborador). Os dados são montados uma vez aqui
 * (regras de quais eventos aparecem, totais, deduções, admissão/rescisão) e cada formato só desenha este modelo —
 * por isso os números nunca divergem entre os arquivos.
 */

export type TipoColuna = "texto" | "moeda" | "inteiro" | "percentual";

export interface Coluna {
  titulo: string;
  tipo: TipoColuna;
  /** Peso relativo da largura da coluna (só uma proporção — cada formato converte pra sua unidade). */
  peso: number;
  /** Coluna em destaque (negrito): Despesa, Nota Fiscal, A cobrar. */
  destaque?: boolean;
}

/** texto, número (moeda/inteiro/percentual) ou null = vazio ("—"). */
export type Celula = string | number | null;

export interface Tabela {
  colunas: Coluna[];
  linhas: Celula[][];
  /** Linha de totais (mesma quantidade de colunas; null = célula vazia) ou null quando a tabela não tem totais. */
  totais: Celula[] | null;
  nota: string | null;
}

export interface LinhaResumo {
  rotulo: string;
  valor: number;
  destaque?: boolean;
}

export interface RelatorioDados {
  /** Linha pequena acima do título ("Relatório de Faturamento", "... individual", com o regime). */
  eyebrow: string;
  /** Centro de custo — ou "NOME (matrícula)" no relatório individual. */
  titulo: string;
  subtitulo: string;
  /** "Admissão: ... · Rescisão: ... (motivo)" — só no relatório individual. */
  vinculo: string | null;
  geradoEm: string;
  qtdColaboradores: number;
  competencia: string;
  /** Texto do rodapé: "Centro de custo (Tomador) · competência". */
  rodape: string;
  resumo: { totais: LinhaResumo[]; retencoes: LinhaResumo[] };
  eventos: Tabela;
  /** null quando não há descontos/informativos nesse centro de custo. */
  descontos: Tabela | null;
  colaboradores: Tabela;
}

/** Admissão e rescisão de um colaborador (datas AAAA-MM-DD). */
export interface VinculoRelatorio {
  admissao: string | null;
  dataDemissao: string | null;
  motivoDemissao: string | null;
}

export interface EntradaRelatorio {
  resumo: CcustoResumo;
  regimeLabel: string | null;
  ccPorMatricula: Map<number, string | null>;
  deducoes: Map<number, DeducaoColaborador>;
  vinculoPorMatricula: Map<number, VinculoRelatorio>;
  /** "NOME (matrícula)" quando o relatório é individual (um colaborador só) — null = relatório do centro de custo. */
  colaboradorLabel: string | null;
  geradoEm?: Date;
}

export function tipoLabel(tipo: RubricaSomada["tipo"], evento: string): string {
  if (normalizaTexto(evento).includes("REEMBOLSO")) return "Reembolso";
  if (tipo === "D" || tipo === "R") return "Desconto";
  if (tipo === "FGTS" || tipo === "INSS") return "Informativo";
  return tipo;
}

function centavos(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Valores em reais arredondados em centavos — o que aparece no arquivo é exatamente o que fica na célula (sem 22318.152000000002). */
function arredondarTabela(t: Tabela): Tabela {
  const arredonda = (v: Celula, col: Coluna): Celula => (typeof v === "number" && col.tipo === "moeda" ? centavos(v) : v);
  return {
    ...t,
    linhas: t.linhas.map((linha) => linha.map((v, i) => arredonda(v, t.colunas[i]))),
    totais: t.totais ? t.totais.map((v, i) => arredonda(v, t.colunas[i])) : null,
  };
}

function soma<T>(itens: T[], pegar: (item: T) => number): number {
  return itens.reduce((acc, item) => acc + pegar(item), 0);
}

function montarEventos(resumo: CcustoResumo): Tabela {
  const comImpacto = resumo.rubricas.filter((r) => r.trilha !== "excluido");
  const ocultas = resumo.rubricas.length - comImpacto.length;
  const colunas: Coluna[] = [
    { titulo: "Evento", tipo: "texto", peso: 16 },
    { titulo: "Valor", tipo: "moeda", peso: 7 },
    { titulo: "INSS", tipo: "moeda", peso: 7 },
    { titulo: "FGTS", tipo: "moeda", peso: 7 },
    { titulo: "Prov. Férias", tipo: "moeda", peso: 7 },
    { titulo: "Prov. 13º", tipo: "moeda", peso: 7 },
    { titulo: "Enc. INSS/Prov.", tipo: "moeda", peso: 8 },
    { titulo: "Enc. FGTS/Prov.", tipo: "moeda", peso: 8 },
    { titulo: "Total Prov.", tipo: "moeda", peso: 7 },
    { titulo: "Despesa (BASE)", tipo: "moeda", peso: 8, destaque: true },
    { titulo: "Taxa Adm", tipo: "moeda", peso: 7 },
    { titulo: "Fatura", tipo: "moeda", peso: 7 },
    { titulo: "Tributação", tipo: "moeda", peso: 7 },
    { titulo: "Nota Fiscal", tipo: "moeda", peso: 7, destaque: true },
  ];
  const linhas = comImpacto.map((r) => [
    r.evento,
    r.valorBruto,
    r.inss,
    r.fgts,
    r.provFerias,
    r.prov13,
    r.encInss,
    r.encFgts,
    r.totalProvisoes,
    r.despesa,
    r.taxaAdm,
    r.fatura,
    r.impostos,
    r.nf,
  ]);
  const totais: Celula[] = [
    "Total",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    resumo.totalDespesas,
    resumo.taxaAdministrativa,
    resumo.totalFaturaSemEncargos,
    soma(comImpacto, (r) => r.impostos),
    soma(comImpacto, (r) => r.nf),
  ];
  return {
    colunas,
    linhas,
    totais,
    nota: ocultas > 0 ? `${ocultas} evento(s) do tipo Desconto/FGTS/INSS não somam faturamento (já refletidos na base do provento) — ver detalhamento de descontos a seguir.` : null,
  };
}

function montarDescontos(resumo: CcustoResumo): Tabela | null {
  const descontos = resumo.rubricas.filter((r) => r.trilha === "excluido");
  if (descontos.length === 0) return null;
  return {
    colunas: [
      { titulo: "Evento", tipo: "texto", peso: 50 },
      { titulo: "Tipo", tipo: "texto", peso: 20 },
      { titulo: "Lançamentos", tipo: "inteiro", peso: 15 },
      { titulo: "Valor", tipo: "moeda", peso: 15 },
    ],
    linhas: descontos.map((r) => [r.evento, tipoLabel(r.tipo, r.evento), r.qtdLancamentos, r.valorBruto]),
    totais: null,
    nota:
      "Descontos (Tipo D/R) são retidos do holerite do colaborador e não reduzem a fatura cobrada do tomador. Linhas informativas (FGTS/INSS) só reafirmam um valor já embutido no provento correspondente.",
  };
}

function montarColaboradores(
  resumo: CcustoResumo,
  ccPorMatricula: Map<number, string | null>,
  deducoes: Map<number, DeducaoColaborador>,
  vinculoPorMatricula: Map<number, VinculoRelatorio>,
): Tabela {
  const comDeducao = resumo.colaboradores.some((c) => deducoes.has(c.matricula));
  const colunas: Coluna[] = [
    { titulo: "Matrícula", tipo: "texto", peso: 8 },
    { titulo: "Nome", tipo: "texto", peso: 21 },
    { titulo: "CC", tipo: "texto", peso: 6 },
    { titulo: "Admissão", tipo: "texto", peso: 8 },
    { titulo: "Rescisão", tipo: "texto", peso: 8 },
    { titulo: "Despesa", tipo: "moeda", peso: 9 },
    { titulo: "Taxa Adm", tipo: "moeda", peso: 8 },
    { titulo: "Fatura", tipo: "moeda", peso: 9 },
    { titulo: "Tributação", tipo: "moeda", peso: 9 },
    { titulo: "Nota Fiscal", tipo: "moeda", peso: 9, destaque: true },
  ];
  if (comDeducao) {
    colunas.push(
      { titulo: "% deduzir", tipo: "percentual", peso: 6 },
      { titulo: "Adiantamento", tipo: "moeda", peso: 9 },
      { titulo: "A cobrar", tipo: "moeda", peso: 9, destaque: true },
      { titulo: "Deduzido", tipo: "moeda", peso: 9 },
    );
  }

  const linhas = resumo.colaboradores.map((c) => {
    const vinculo = vinculoPorMatricula.get(c.matricula);
    const linha: Celula[] = [
      String(c.matricula),
      c.nome,
      ccPorMatricula.get(c.matricula) ?? null,
      formatarDataBr(vinculo?.admissao),
      formatarDataBr(vinculo?.dataDemissao),
      c.despesa,
      c.taxaAdm,
      c.fatura,
      c.impostos,
      c.nf,
    ];
    if (comDeducao) {
      const d = deducoes.get(c.matricula);
      const r = calcularCobranca(c.nf, d?.percentual ?? null, d?.adiantamento ?? 0);
      linha.push(d?.percentual ?? null, d?.adiantamento ? d.adiantamento : null, d ? r.cobrar : null, d ? r.deduzido : null);
    }
    return linha;
  });

  const totais: Celula[] = [
    "Total",
    null,
    null,
    null,
    null,
    resumo.totalDespesas,
    resumo.taxaAdministrativa,
    resumo.totalFaturaSemEncargos,
    soma(resumo.colaboradores, (c) => c.impostos),
    soma(resumo.colaboradores, (c) => c.nf),
  ];
  if (comDeducao) {
    const t = somarCobranca(resumo.colaboradores, deducoes);
    totais.push(null, t.adiantamentos > 0 ? t.adiantamentos : null, t.cobrar, t.deduzido);
  }
  return { colunas, linhas, totais, nota: null };
}

/** Monta o relatório inteiro (cabeçalho, resumo e as três tabelas) a partir do que a rota de exportação já carregou. */
export function montarRelatorio(entrada: EntradaRelatorio): RelatorioDados {
  const { resumo, regimeLabel, ccPorMatricula, deducoes, vinculoPorMatricula, colaboradorLabel } = entrada;
  // Com deduções por colaborador (percentual e/ou adiantamento), os tributos incidem sobre o valor a cobrar — não sobre o Total fatura.
  const cobranca = calcularRetencoesSobreCobrado(resumo, deducoes);

  const totais: LinhaResumo[] = [
    { rotulo: "Total de despesas", valor: resumo.totalDespesas },
    { rotulo: "Taxa administrativa", valor: resumo.taxaAdministrativa },
    { rotulo: "Fatura (despesas + taxa)", valor: resumo.totalFaturaSemEncargos },
    { rotulo: "Encargos (PIS/COFINS/ISS/CSLL/IRRF)", valor: resumo.encargosFatura.total },
    { rotulo: "Total fatura (com encargos)", valor: resumo.totalFatura, destaque: true },
  ];
  if (cobranca) {
    totais.push(
      { rotulo: "Valor a cobrar (soma por colaborador)", valor: cobranca.cobrar, destaque: true },
      { rotulo: "Deduzido (soma das deduções por colaborador)", valor: cobranca.deduzido },
    );
    if (cobranca.adiantamentos > 0) totais.push({ rotulo: "do qual adiantamentos", valor: cobranca.adiantamentos });
  }

  const r = cobranca?.retencoes ?? resumo.retencoes;
  const retencoes: LinhaResumo[] = [
    ...(cobranca ? [{ rotulo: "Base das retenções (valor a cobrar)", valor: cobranca.baseRetencoes }] : []),
    { rotulo: "Retenção IRRF (1%)", valor: r.irrf },
    { rotulo: "Retenção CSLL (1%)", valor: r.csll },
    { rotulo: "Retenção COFINS (3%)", valor: r.cofins },
    { rotulo: "Retenção PIS (0,65%)", valor: r.pis },
    { rotulo: "Retenção ISS (2%)", valor: r.iss },
    { rotulo: "Retenção INSS (11%, s/ VT-VR-VA-Bonif.)", valor: r.inss },
    { rotulo: "Valor líquido a receber", valor: cobranca ? cobranca.valorLiquido : resumo.valorLiquido, destaque: true },
  ];

  // Relatório individual: um colaborador só no resumo — a admissão e a rescisão dele ficam no cabeçalho.
  const unico = colaboradorLabel && resumo.colaboradores.length === 1 ? resumo.colaboradores[0] : null;
  const v = unico ? vinculoPorMatricula.get(unico.matricula) : undefined;
  const vinculo = unico
    ? `Admissão: ${formatarDataBr(v?.admissao) ?? "—"} · Rescisão: ${formatarDataBr(v?.dataDemissao) ?? "—"}${
        v?.dataDemissao && v.motivoDemissao ? ` (${v.motivoDemissao})` : ""
      }`
    : null;

  return {
    eyebrow: `${colaboradorLabel ? "Relatório de Faturamento individual" : "Relatório de Faturamento"}${regimeLabel ? ` · ${regimeLabel}` : ""}`,
    titulo: colaboradorLabel ?? resumo.ccustoNome,
    subtitulo: `${colaboradorLabel ? `${resumo.ccustoNome} · ` : ""}Tomador: ${resumo.tomadorNome} · Competência ${resumo.competencia}`,
    vinculo,
    geradoEm: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(entrada.geradoEm ?? new Date()),
    qtdColaboradores: resumo.qtdColaboradores,
    competencia: resumo.competencia,
    rodape: `${resumo.ccustoNome} (${resumo.tomadorNome})${regimeLabel ? ` · Regime: ${regimeLabel}` : ""} · ${resumo.competencia}`,
    resumo: {
      totais: totais.map((l) => ({ ...l, valor: centavos(l.valor) })),
      retencoes: retencoes.map((l) => ({ ...l, valor: centavos(l.valor) })),
    },
    eventos: arredondarTabela(montarEventos(resumo)),
    descontos: (() => {
      const d = montarDescontos(resumo);
      return d ? arredondarTabela(d) : null;
    })(),
    colaboradores: arredondarTabela(montarColaboradores(resumo, ccPorMatricula, deducoes, vinculoPorMatricula)),
  };
}
