import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ColaboradorResumo, RubricaSomada, CcustoResumo } from "../calc/aggregate";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function fmt(n: number): string {
  return currency.format(n);
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

function Footer({ resumo }: { resumo: CcustoResumo }) {
  return (
    <Text
      style={styles.footer}
      render={({ pageNumber, totalPages }) =>
        `${resumo.ccustoNome} (${resumo.tomadorNome}) · ${resumo.competencia}     •     página ${pageNumber} de ${totalPages}`
      }
      fixed
    />
  );
}

function SummarySection({ resumo }: { resumo: CcustoResumo }) {
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
  { key: "evento", label: "Evento", width: "18%" },
  { key: "valorBruto", label: "Valor", width: "7%" },
  { key: "inss", label: "INSS", width: "7%" },
  { key: "fgts", label: "FGTS", width: "7%" },
  { key: "provFerias", label: "Prov. Férias", width: "8%" },
  { key: "prov13", label: "Prov. 13º", width: "7%" },
  { key: "encInss", label: "Enc. INSS/Prov.", width: "9%" },
  { key: "encFgts", label: "Enc. FGTS/Prov.", width: "9%" },
  { key: "totalProvisoes", label: "Total Prov.", width: "8%" },
  { key: "despesa", label: "Despesa (BASE)", width: "9%", strong: true },
  { key: "taxaAdm", label: "Taxa Adm", width: "7%" },
  { key: "fatura", label: "Fatura", width: "7%" },
  { key: "nf", label: "NF", width: "7%" },
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
          <Text style={[styles.totalsCell, { width: "18%" }]}>Total</Text>
          <Text style={[styles.totalsCellRight, { width: "7%" }]} />
          <Text style={[styles.totalsCellRight, { width: "7%" }]} />
          <Text style={[styles.totalsCellRight, { width: "7%" }]} />
          <Text style={[styles.totalsCellRight, { width: "8%" }]} />
          <Text style={[styles.totalsCellRight, { width: "7%" }]} />
          <Text style={[styles.totalsCellRight, { width: "9%" }]} />
          <Text style={[styles.totalsCellRight, { width: "9%" }]} />
          <Text style={[styles.totalsCellRight, { width: "8%" }]} />
          <Text style={[styles.totalsCellRight, { width: "9%" }]}>{fmt(resumo.totalDespesas)}</Text>
          <Text style={[styles.totalsCellRight, { width: "7%" }]}>{fmt(resumo.taxaAdministrativa)}</Text>
          <Text style={[styles.totalsCellRight, { width: "7%" }]}>{fmt(resumo.totalFaturaSemEncargos)}</Text>
          <Text style={[styles.totalsCellRight, { width: "7%" }]}>{fmt(resumo.totalFatura)}</Text>
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

function tipoLabel(tipo: RubricaSomada["tipo"]): string {
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
            <Text style={[styles.tCell, { width: "20%" }]}>{tipoLabel(r.tipo)}</Text>
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

const COLAB_COLS: { key: keyof ColaboradorResumo; label: string; width: string }[] = [
  { key: "matricula", label: "Matrícula", width: "14%" },
  { key: "nome", label: "Nome", width: "42%" },
  { key: "despesa", label: "Despesa", width: "11%" },
  { key: "taxaAdm", label: "Taxa Adm", width: "11%" },
  { key: "fatura", label: "Fatura", width: "11%" },
  { key: "nf", label: "NF", width: "11%" },
];

function ColaboradoresSection({ resumo }: { resumo: CcustoResumo }) {
  return (
    <View break>
      <Text style={styles.sectionTitle}>Detalhamento por colaborador ({resumo.qtdColaboradores})</Text>
      <View style={styles.table}>
        <View style={styles.tHeadRow} fixed>
          {COLAB_COLS.map((c) => (
            <Text key={c.key} style={[styles.tHeadCell, { width: c.width, textAlign: c.key === "matricula" || c.key === "nome" ? "left" : "right" }]}>
              {c.label}
            </Text>
          ))}
        </View>
        {resumo.colaboradores.map((c, i) => (
          <View key={c.matricula} style={i % 2 === 1 ? styles.tRowAlt : styles.tRow} wrap={false}>
            <Text style={[styles.tCell, { width: "14%" }]}>{c.matricula}</Text>
            <Text style={[styles.tCell, { width: "42%" }]}>{c.nome}</Text>
            <Text style={[styles.tCellRight, { width: "11%" }]}>{fmt(c.despesa)}</Text>
            <Text style={[styles.tCellRight, { width: "11%" }]}>{fmt(c.taxaAdm)}</Text>
            <Text style={[styles.tCellRight, { width: "11%" }]}>{fmt(c.fatura)}</Text>
            <Text style={[styles.tCellRight, { width: "11%" }]}>{fmt(c.nf)}</Text>
          </View>
        ))}
        <View style={styles.totalsRow}>
          <Text style={[styles.totalsCell, { width: "56%" }]}>Total</Text>
          <Text style={[styles.totalsCellRight, { width: "11%" }]}>{fmt(resumo.totalDespesas)}</Text>
          <Text style={[styles.totalsCellRight, { width: "11%" }]}>{fmt(resumo.taxaAdministrativa)}</Text>
          <Text style={[styles.totalsCellRight, { width: "11%" }]}>{fmt(resumo.totalFaturaSemEncargos)}</Text>
          <Text style={[styles.totalsCellRight, { width: "11%" }]}>{fmt(resumo.totalFatura)}</Text>
        </View>
      </View>
    </View>
  );
}

export function FaturamentoPdf({ resumo, warnings }: { resumo: CcustoResumo; warnings: string[] }) {
  const geradoEm = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());

  return (
    <Document title={`Faturamento - ${resumo.ccustoNome} - ${resumo.competencia}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Relatório de Faturamento</Text>
            <Text style={styles.title}>{resumo.ccustoNome}</Text>
            <Text style={styles.subtitle}>Tomador: {resumo.tomadorNome} · Competência {resumo.competencia}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Gerado em</Text>
            <Text style={styles.metaValue}>{geradoEm}</Text>
            <Text style={styles.metaLabel}>Colaboradores</Text>
            <Text style={styles.metaValue}>{resumo.qtdColaboradores}</Text>
          </View>
        </View>

        <SummarySection resumo={resumo} />

        {warnings.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Avisos ({warnings.length})</Text>
            {warnings.slice(0, 12).map((w, i) => (
              <Text key={i} style={styles.footnote}>
                • {w}
              </Text>
            ))}
            {warnings.length > 12 && <Text style={styles.footnote}>+ {warnings.length - 12} aviso(s) adicional(is).</Text>}
          </View>
        )}

        <RubricasSection resumo={resumo} />
        <DescontosSection resumo={resumo} />
        <ColaboradoresSection resumo={resumo} />

        <Footer resumo={resumo} />
      </Page>
    </Document>
  );
}
