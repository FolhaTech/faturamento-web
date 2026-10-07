import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { RubricaSomada, CcustoResumo } from "../calc/aggregate";
import { calcularCobranca } from "../percentualCobranca";
import { normalizaTexto } from "../text";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function fmt(n: number): string {
  return currency.format(n);
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + pick(item), 0);
}

const INK = "#1e2420";
const INK_SOFT = "#4f5951";
const ACCENT = "#0f6b4c";
const ACCENT_SOFT = "#e4f2ec";
const LINE = "#d7ded9";
const HEADER_BG = "#0f6b4c";

const styles = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 36, paddingHorizontal: 28, fontSize: 8.5, fontFamily: "Helvetica", color: INK },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: ACCENT,
    paddingBottom: 10,
    marginBottom: 14,
  },
  eyebrow: { fontSize: 8, color: ACCENT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", color: INK },
  subtitle: { fontSize: 9, color: INK_SOFT, marginTop: 2 },
  metaBlock: { alignItems: "flex-end" },
  metaLabel: { fontSize: 7, color: INK_SOFT, textTransform: "uppercase" },
  metaValue: { fontSize: 9, color: INK, marginBottom: 4 },

  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: INK,
    marginTop: 16,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },

  summaryGrid: { flexDirection: "row", gap: 10 },
  summaryCol: { flex: 1, gap: 5 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
  },
  summaryLabel: { fontSize: 8.5, color: INK_SOFT },
  summaryValue: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: INK },
  summaryRowStrong: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: ACCENT_SOFT,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 2,
    marginTop: 2,
  },
  summaryLabelStrong: { fontSize: 9, fontFamily: "Helvetica-Bold", color: ACCENT },
  summaryValueStrong: { fontSize: 10, fontFamily: "Helvetica-Bold", color: ACCENT },

  table: { borderWidth: 0.5, borderColor: LINE, marginTop: 4 },
  tHeadRow: { flexDirection: "row", backgroundColor: HEADER_BG },
  tHeadCell: { color: "#ffffff", fontSize: 7, fontFamily: "Helvetica-Bold", padding: 4, textTransform: "uppercase" },
  tRow: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: LINE },
  tRowAlt: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: LINE, backgroundColor: "#f7f9f7" },
  tCell: { fontSize: 7.5, padding: 4, color: INK },
  tCellRight: { fontSize: 7.5, padding: 4, color: INK, textAlign: "right" },
  tCellStrong: { fontSize: 7.5, padding: 4, color: INK, textAlign: "right", fontFamily: "Helvetica-Bold" },
  totalsRow: { flexDirection: "row", backgroundColor: ACCENT_SOFT, borderTopWidth: 1, borderTopColor: ACCENT },
  totalsCell: { fontSize: 7.5, padding: 4, color: ACCENT, fontFamily: "Helvetica-Bold" },
  totalsCellRight: { fontSize: 7.5, padding: 4, color: ACCENT, fontFamily: "Helvetica-Bold", textAlign: "right" },

  footer: {
    position: "absolute",
    bottom: 14,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: INK_SOFT,
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    paddingTop: 6,
  },
  footnote: { fontSize: 7, color: INK_SOFT, marginTop: 6 },
});

function Footer({ resumo, regimeLabel }: { resumo: CcustoResumo; regimeLabel: string | null }) {
  return (
    <Text
      style={styles.footer}
      render={({ pageNumber, totalPages }) =>
        `${resumo.ccustoNome} (${resumo.tomadorNome})${regimeLabel ? ` · Regime: ${regimeLabel}` : ""} · ${resumo.competencia}     •     página ${pageNumber} de ${totalPages}`
      }
      fixed
    />
  );
}

/** Soma por colaborador do que será cobrado/deduzido — null quando nenhum colaborador desse relatório tem percentual. Sem percentual entra a NF inteira. */
function somaCobranca(resumo: CcustoResumo, percentuais: Map<number, number>): { cobrar: number; deduzido: number } | null {
  if (!resumo.colaboradores.some((c) => percentuais.has(c.matricula))) return null;
  let cobrar = 0;
  let deduzido = 0;
  for (const c of resumo.colaboradores) {
    const r = calcularCobranca(c.nf, percentuais.get(c.matricula) ?? null);
    cobrar += r.cobrar;
    deduzido += r.deduzido;
  }
  return { cobrar: Math.round(cobrar * 100) / 100, deduzido: Math.round(deduzido * 100) / 100 };
}

function SummarySection({ resumo, percentuaisCobranca }: { resumo: CcustoResumo; percentuaisCobranca: Map<number, number> }) {
  const cobranca = somaCobranca(resumo, percentuaisCobranca);
  return (
    <View>
      <Text style={styles.sectionTitle}>Resumo</Text>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryCol}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total de despesas</Text>
            <Text style={styles.summaryValue}>{fmt(resumo.totalDespesas)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Taxa administrativa</Text>
            <Text style={styles.summaryValue}>{fmt(resumo.taxaAdministrativa)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Fatura (despesas + taxa)</Text>
            <Text style={styles.summaryValue}>{fmt(resumo.totalFaturaSemEncargos)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Encargos (PIS/COFINS/ISS/CSLL/IRRF)</Text>
            <Text style={styles.summaryValue}>{fmt(resumo.encargosFatura.total)}</Text>
          </View>
          <View style={styles.summaryRowStrong}>
            <Text style={styles.summaryLabelStrong}>Total fatura (com encargos)</Text>
            <Text style={styles.summaryValueStrong}>{fmt(resumo.totalFatura)}</Text>
          </View>
          {cobranca && (
            <>
              <View style={styles.summaryRowStrong}>
                <Text style={styles.summaryLabelStrong}>Valor a cobrar (soma por colaborador)</Text>
                <Text style={styles.summaryValueStrong}>{fmt(cobranca.cobrar)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Deduzido (Nota Fiscal menos valor a cobrar)</Text>
                <Text style={styles.summaryValue}>{fmt(cobranca.deduzido)}</Text>
              </View>
            </>
          )}
        </View>
        <View style={styles.summaryCol}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Retenção IRRF (1%)</Text>
            <Text style={styles.summaryValue}>{fmt(resumo.retencoes.irrf)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Retenção CSLL (1%)</Text>
            <Text style={styles.summaryValue}>{fmt(resumo.retencoes.csll)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Retenção COFINS (3%)</Text>
            <Text style={styles.summaryValue}>{fmt(resumo.retencoes.cofins)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Retenção PIS (0,65%)</Text>
            <Text style={styles.summaryValue}>{fmt(resumo.retencoes.pis)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Retenção ISS (2%)</Text>
            <Text style={styles.summaryValue}>{fmt(resumo.retencoes.iss)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Retenção INSS (11%, s/ VT-VR-VA-Bonif.)</Text>
            <Text style={styles.summaryValue}>{fmt(resumo.retencoes.inss)}</Text>
          </View>
          <View style={styles.summaryRowStrong}>
            <Text style={styles.summaryLabelStrong}>Valor líquido a receber</Text>
            <Text style={styles.summaryValueStrong}>{fmt(resumo.valorLiquido)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const RUBRICA_COLS: { key: keyof RubricaSomada; label: string; width: string; strong?: boolean }[] = [
  { key: "evento", label: "Evento", width: "16%" },
  { key: "valorBruto", label: "Valor", width: "7%" },
  { key: "inss", label: "INSS", width: "7%" },
  { key: "fgts", label: "FGTS", width: "7%" },
  { key: "provFerias", label: "Prov. Férias", width: "7%" },
  { key: "prov13", label: "Prov. 13º", width: "7%" },
  { key: "encInss", label: "Enc. INSS/Prov.", width: "8%" },
  { key: "encFgts", label: "Enc. FGTS/Prov.", width: "8%" },
  { key: "totalProvisoes", label: "Total Prov.", width: "7%" },
  { key: "despesa", label: "Despesa (BASE)", width: "8%", strong: true },
  { key: "taxaAdm", label: "Taxa Adm", width: "7%" },
  { key: "fatura", label: "Fatura", width: "7%" },
  { key: "impostos", label: "Tributação", width: "7%" },
  { key: "nf", label: "Nota Fiscal", width: "7%", strong: true },
];

function RubricasSection({ resumo }: { resumo: CcustoResumo }) {
  const comImpacto = resumo.rubricas.filter((r) => r.trilha !== "excluido");
  const ocultas = resumo.rubricas.length - comImpacto.length;

  return (
    <View break>
      <Text style={styles.sectionTitle}>Detalhamento por evento</Text>
      <View style={styles.table}>
        <View style={styles.tHeadRow} fixed>
          {RUBRICA_COLS.map((c) => (
            <Text key={c.key} style={[styles.tHeadCell, { width: c.width, textAlign: c.key === "evento" ? "left" : "right" }]}>
              {c.label}
            </Text>
          ))}
        </View>
        {comImpacto.map((r, i) => (
          <View key={r.evento} style={i % 2 === 1 ? styles.tRowAlt : styles.tRow} wrap={false}>
            {RUBRICA_COLS.map((c) =>
              c.key === "evento" ? (
                <Text key={c.key} style={[styles.tCell, { width: c.width }]}>
                  {r.evento}
                </Text>
              ) : (
                <Text key={c.key} style={[c.strong ? styles.tCellStrong : styles.tCellRight, { width: c.width }]}>
                  {fmt(r[c.key] as number)}
                </Text>
              ),
            )}
          </View>
        ))}
        <View style={styles.totalsRow}>
          <Text style={[styles.totalsCell, { width: "16%" }]}>Total</Text>
          <Text style={[styles.totalsCellRight, { width: "7%" }]} />
          <Text style={[styles.totalsCellRight, { width: "7%" }]} />
          <Text style={[styles.totalsCellRight, { width: "7%" }]} />
          <Text style={[styles.totalsCellRight, { width: "7%" }]} />
          <Text style={[styles.totalsCellRight, { width: "7%" }]} />
          <Text style={[styles.totalsCellRight, { width: "8%" }]} />
          <Text style={[styles.totalsCellRight, { width: "8%" }]} />
          <Text style={[styles.totalsCellRight, { width: "7%" }]} />
          <Text style={[styles.totalsCellRight, { width: "8%" }]}>{fmt(resumo.totalDespesas)}</Text>
          <Text style={[styles.totalsCellRight, { width: "7%" }]}>{fmt(resumo.taxaAdministrativa)}</Text>
          <Text style={[styles.totalsCellRight, { width: "7%" }]}>{fmt(resumo.totalFaturaSemEncargos)}</Text>
          <Text style={[styles.totalsCellRight, { width: "7%" }]}>{fmt(sum(comImpacto, (r) => r.impostos))}</Text>
          <Text style={[styles.totalsCellRight, { width: "7%" }]}>{fmt(sum(comImpacto, (r) => r.nf))}</Text>
        </View>
      </View>
      {ocultas > 0 && (
        <Text style={styles.footnote}>
          {ocultas} evento(s) do tipo Desconto/FGTS/INSS não somam faturamento (já refletidos na base do provento) — ver detalhamento de descontos a seguir.
        </Text>
      )}
    </View>
  );
}

function tipoLabel(tipo: RubricaSomada["tipo"], evento: string): string {
  if (normalizaTexto(evento).includes("REEMBOLSO")) return "Reembolso";
  if (tipo === "D" || tipo === "R") return "Desconto";
  if (tipo === "FGTS" || tipo === "INSS") return "Informativo";
  return tipo;
}

function DescontosSection({ resumo }: { resumo: CcustoResumo }) {
  const descontos = resumo.rubricas.filter((r) => r.trilha === "excluido");
  if (descontos.length === 0) return null;

  return (
    <View break>
      <Text style={styles.sectionTitle}>Descontos e linhas informativas</Text>
      <View style={styles.table}>
        <View style={styles.tHeadRow} fixed>
          <Text style={[styles.tHeadCell, { width: "50%" }]}>Evento</Text>
          <Text style={[styles.tHeadCell, { width: "20%" }]}>Tipo</Text>
          <Text style={[styles.tHeadCell, { width: "15%", textAlign: "right" }]}>Lançamentos</Text>
          <Text style={[styles.tHeadCell, { width: "15%", textAlign: "right" }]}>Valor</Text>
        </View>
        {descontos.map((r, i) => (
          <View key={r.evento} style={i % 2 === 1 ? styles.tRowAlt : styles.tRow} wrap={false}>
            <Text style={[styles.tCell, { width: "50%" }]}>{r.evento}</Text>
            <Text style={[styles.tCell, { width: "20%" }]}>{tipoLabel(r.tipo, r.evento)}</Text>
            <Text style={[styles.tCellRight, { width: "15%" }]}>{r.qtdLancamentos}</Text>
            <Text style={[styles.tCellRight, { width: "15%" }]}>{fmt(r.valorBruto)}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.footnote}>
        Descontos (Tipo D/R) são retidos do holerite do colaborador e não reduzem a fatura cobrada do tomador. Linhas informativas (FGTS/INSS) só
        reafirmam um valor já embutido no provento correspondente.
      </Text>
    </View>
  );
}

/** Larguras da tabela de colaboradores; com percentual a cobrar entram 3 colunas e as demais ficam mais estreitas (somam 100% nos dois casos). */
const COLAB_LARGURAS = {
  base: { matricula: "10%", nome: "29%", cc: "9%", despesa: "10%", taxaAdm: "10%", fatura: "10%", impostos: "11%", nf: "11%", pct: "0%", cobrar: "0%", deduzido: "0%" },
  comCobranca: { matricula: "8%", nome: "19%", cc: "7%", despesa: "8%", taxaAdm: "8%", fatura: "8%", impostos: "8%", nf: "9%", pct: "6%", cobrar: "9%", deduzido: "10%" },
} as const;

function ColaboradoresSection({
  resumo,
  ccPorMatricula,
  percentuaisCobranca,
}: {
  resumo: CcustoResumo;
  ccPorMatricula: Map<number, string | null>;
  percentuaisCobranca: Map<number, number>;
}) {
  const totais = somaCobranca(resumo, percentuaisCobranca);
  const comCobranca = totais !== null;
  const w = comCobranca ? COLAB_LARGURAS.comCobranca : COLAB_LARGURAS.base;
  return (
    <View break>
      <Text style={styles.sectionTitle}>Detalhamento por colaborador ({resumo.qtdColaboradores})</Text>
      <View style={styles.table}>
        <View style={styles.tHeadRow} fixed>
          <Text style={[styles.tHeadCell, { width: w.matricula, textAlign: "left" }]}>Matrícula</Text>
          <Text style={[styles.tHeadCell, { width: w.nome, textAlign: "left" }]}>Nome</Text>
          <Text style={[styles.tHeadCell, { width: w.cc, textAlign: "left" }]}>CC</Text>
          <Text style={[styles.tHeadCell, { width: w.despesa, textAlign: "right" }]}>Despesa</Text>
          <Text style={[styles.tHeadCell, { width: w.taxaAdm, textAlign: "right" }]}>Taxa Adm</Text>
          <Text style={[styles.tHeadCell, { width: w.fatura, textAlign: "right" }]}>Fatura</Text>
          <Text style={[styles.tHeadCell, { width: w.impostos, textAlign: "right" }]}>Tributação</Text>
          <Text style={[styles.tHeadCell, { width: w.nf, textAlign: "right" }]}>Nota Fiscal</Text>
          {comCobranca && (
            <>
              <Text style={[styles.tHeadCell, { width: w.pct, textAlign: "right" }]}>% cobrar</Text>
              <Text style={[styles.tHeadCell, { width: w.cobrar, textAlign: "right" }]}>A cobrar</Text>
              <Text style={[styles.tHeadCell, { width: w.deduzido, textAlign: "right" }]}>Deduzido</Text>
            </>
          )}
        </View>
        {resumo.colaboradores.map((c, i) => {
          const percentual = percentuaisCobranca.get(c.matricula) ?? null;
          const cobranca = calcularCobranca(c.nf, percentual);
          return (
            <View key={c.matricula} style={i % 2 === 1 ? styles.tRowAlt : styles.tRow} wrap={false}>
              <Text style={[styles.tCell, { width: w.matricula }]}>{c.matricula}</Text>
              <Text style={[styles.tCell, { width: w.nome }]}>{c.nome}</Text>
              <Text style={[styles.tCell, { width: w.cc }]}>{ccPorMatricula.get(c.matricula) ?? ""}</Text>
              <Text style={[styles.tCellRight, { width: w.despesa }]}>{fmt(c.despesa)}</Text>
              <Text style={[styles.tCellRight, { width: w.taxaAdm }]}>{fmt(c.taxaAdm)}</Text>
              <Text style={[styles.tCellRight, { width: w.fatura }]}>{fmt(c.fatura)}</Text>
              <Text style={[styles.tCellRight, { width: w.impostos }]}>{fmt(c.impostos)}</Text>
              <Text style={[styles.tCellStrong, { width: w.nf }]}>{fmt(c.nf)}</Text>
              {comCobranca && (
                <>
                  <Text style={[styles.tCellRight, { width: w.pct }]}>{percentual === null ? "—" : `${percentual.toLocaleString("pt-BR")}%`}</Text>
                  <Text style={[styles.tCellStrong, { width: w.cobrar }]}>{percentual === null ? "—" : fmt(cobranca.cobrar)}</Text>
                  <Text style={[styles.tCellRight, { width: w.deduzido }]}>{percentual === null ? "—" : fmt(cobranca.deduzido)}</Text>
                </>
              )}
            </View>
          );
        })}
        <View style={styles.totalsRow}>
          <Text style={[styles.totalsCell, { width: `${parseFloat(w.matricula) + parseFloat(w.nome) + parseFloat(w.cc)}%` }]}>Total</Text>
          <Text style={[styles.totalsCellRight, { width: w.despesa }]}>{fmt(resumo.totalDespesas)}</Text>
          <Text style={[styles.totalsCellRight, { width: w.taxaAdm }]}>{fmt(resumo.taxaAdministrativa)}</Text>
          <Text style={[styles.totalsCellRight, { width: w.fatura }]}>{fmt(resumo.totalFaturaSemEncargos)}</Text>
          <Text style={[styles.totalsCellRight, { width: w.impostos }]}>{fmt(sum(resumo.colaboradores, (c) => c.impostos))}</Text>
          <Text style={[styles.totalsCellRight, { width: w.nf }]}>{fmt(sum(resumo.colaboradores, (c) => c.nf))}</Text>
          {totais && (
            <>
              <Text style={[styles.totalsCellRight, { width: w.pct }]} />
              <Text style={[styles.totalsCellRight, { width: w.cobrar }]}>{fmt(totais.cobrar)}</Text>
              <Text style={[styles.totalsCellRight, { width: w.deduzido }]}>{fmt(totais.deduzido)}</Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

export function FaturamentoPdf({
  resumo,
  regimeLabel = null,
  ccPorMatricula,
  percentuaisCobranca = new Map<number, number>(),
  colaboradorLabel = null,
}: {
  resumo: CcustoResumo;
  /** "Terceiro (CLT)" ou "Temporário" quando o export foi filtrado por regime (ver /api/faturamento/export) — null pra fatura sem esse filtro (mistura os dois regimes). */
  regimeLabel?: string | null;
  /** CC (não obrigatório) de cada colaborador — ver ColaboradoresSection. */
  ccPorMatricula: Map<number, string | null>;
  /** Percentual da Nota Fiscal de cada colaborador que o usuário quer cobrar (campo na tela de Faturamento, matrícula -> %) — vazio = sem as colunas e linhas de cobrança. */
  percentuaisCobranca?: Map<number, number>;
  /** "NOME (matrícula)" quando o PDF é individual (um colaborador só) — aparece no cabeçalho; null = relatório do centro de custo. */
  colaboradorLabel?: string | null;
}) {
  const geradoEm = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());

  return (
    <Document title={`Faturamento - ${resumo.ccustoNome}${regimeLabel ? ` - ${regimeLabel}` : ""} - ${resumo.competencia}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>
              {colaboradorLabel ? "Relatório de Faturamento individual" : "Relatório de Faturamento"}
              {regimeLabel ? ` · ${regimeLabel}` : ""}
            </Text>
            <Text style={styles.title}>{colaboradorLabel ?? resumo.ccustoNome}</Text>
            <Text style={styles.subtitle}>
              {colaboradorLabel ? `${resumo.ccustoNome} · ` : ""}Tomador: {resumo.tomadorNome} · Competência {resumo.competencia}
            </Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Gerado em</Text>
            <Text style={styles.metaValue}>{geradoEm}</Text>
            <Text style={styles.metaLabel}>Colaboradores</Text>
            <Text style={styles.metaValue}>{resumo.qtdColaboradores}</Text>
          </View>
        </View>

        <SummarySection resumo={resumo} percentuaisCobranca={percentuaisCobranca} />

        <RubricasSection resumo={resumo} />
        <DescontosSection resumo={resumo} />
        <ColaboradoresSection resumo={resumo} ccPorMatricula={ccPorMatricula} percentuaisCobranca={percentuaisCobranca} />

        <Footer resumo={resumo} regimeLabel={regimeLabel} />
      </Page>
    </Document>
  );
}
