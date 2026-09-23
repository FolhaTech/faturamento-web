import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function fmt(n: number): string {
  return currency.format(n);
}

const INK = "#1e2420";
const INK_SOFT = "#4f5951";
const ACCENT = "#0f6b4c";
const LINE = "#d7ded9";
const COMPARE_BG = "#eff6ff";
const COMPARE_BORDER = "#93c5fd";
const COMPARE_TEXT = "#1e3a5f";
const CREDIT_TEXT = "#92400e";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9.5, fontFamily: "Helvetica", color: INK },
  header: { borderBottomWidth: 2, borderBottomColor: ACCENT, paddingBottom: 10, marginBottom: 18 },
  eyebrow: { fontSize: 8.5, color: ACCENT, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
  title: { fontSize: 17, fontFamily: "Helvetica-Bold", color: INK },
  subtitle: { fontSize: 9.5, color: INK_SOFT, marginTop: 3 },

  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: LINE },
  label: { fontSize: 10, color: INK_SOFT },
  value: { fontSize: 10, fontFamily: "Helvetica-Bold", color: INK },

  resultBox: { marginTop: 16, borderWidth: 0.5, borderColor: COMPARE_BORDER, backgroundColor: COMPARE_BG, borderRadius: 3, padding: 16 },
  resultLabel: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: COMPARE_TEXT, textTransform: "uppercase", letterSpacing: 0.5 },
  resultValue: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 6 },
  resultNote: { fontSize: 8.5, color: COMPARE_TEXT, marginTop: 6 },

  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    fontSize: 7.5,
    color: INK_SOFT,
    borderTopWidth: 0.5,
    borderTopColor: LINE,
    paddingTop: 6,
  },
});

export interface ComparativoPdfProps {
  ccustoNome: string;
  tomadorNome: string;
  /** Competência da Folha, com o sufixo "(Folha)" — ver tipoCompetencia.ts. */
  competenciaFolha: string;
  /** Competência da Prévia correspondente, com o sufixo "(Prévia)". */
  competenciaPrevia: string;
  totalFaturaFolha: number;
  totalFaturaPrevia: number;
}

/** PDF separado do relatório de faturamento — só o comparativo Prévia × Folha (ver /api/faturamento/export-comparativo). */
export function ComparativoPdf({ ccustoNome, tomadorNome, competenciaFolha, competenciaPrevia, totalFaturaFolha, totalFaturaPrevia }: ComparativoPdfProps) {
  const complementar = totalFaturaFolha - totalFaturaPrevia;
  const geradoEm = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());

  return (
    <Document title={`Comparativo Previa Folha - ${ccustoNome} - ${competenciaFolha}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Comparativo Prévia × Folha</Text>
          <Text style={styles.title}>{ccustoNome}</Text>
          <Text style={styles.subtitle}>Tomador: {tomadorNome}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Total fatura na Prévia ({competenciaPrevia})</Text>
          <Text style={styles.value}>{fmt(totalFaturaPrevia)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Total fatura na Folha ({competenciaFolha})</Text>
          <Text style={styles.value}>{fmt(totalFaturaFolha)}</Text>
        </View>

        <View style={styles.resultBox}>
          <Text style={styles.resultLabel}>{complementar >= 0 ? "Complementar a cobrar" : "Complementar a creditar"}</Text>
          <Text style={[styles.resultValue, { color: complementar >= 0 ? COMPARE_TEXT : CREDIT_TEXT }]}>{fmt(complementar)}</Text>
          <Text style={styles.resultNote}>
            Diferença entre o total fatura da Folha e o total já cobrado na Prévia do mesmo mês — a Prévia já foi cobrada do cliente antes, só essa
            diferença falta {complementar >= 0 ? "faturar" : "creditar"} agora que a Folha fechou.
          </Text>
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `${ccustoNome} (${tomadorNome}) · Gerado em ${geradoEm}     •     página ${pageNumber} de ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
