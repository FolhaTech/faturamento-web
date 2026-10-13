import { describe, expect, it } from "vitest";
import type { CcustoResumo, RubricaSomada } from "../calc/aggregate";
import { montarRelatorio, tipoLabel, type EntradaRelatorio } from "./relatorio";

const rubrica = (evento: string, tipo: RubricaSomada["tipo"], trilha: RubricaSomada["trilha"], valor: number): RubricaSomada => ({
  codigo: 1,
  evento,
  tipo,
  trilha,
  qtdLancamentos: 2,
  valorBruto: valor,
  inss: 0,
  fgts: 0,
  provFerias: 0,
  prov13: 0,
  encInss: 0,
  encFgts: 0,
  totalProvisoes: 0,
  despesa: valor,
  taxaAdm: valor * 0.1,
  fatura: valor * 1.1,
  impostos: valor * 0.15,
  nf: valor * 1.25,
});

const colaborador = (matricula: number, nome: string, nf: number) => ({ matricula, nome, despesa: nf * 0.8, taxaAdm: nf * 0.08, fatura: nf * 0.88, impostos: nf * 0.12, nf, rubricas: [] });

const resumo: CcustoResumo = {
  ccustoCodigo: "8",
  ccustoNome: "ITAU HOSPITAU 1020",
  tomadorCodigo: 14,
  tomadorNome: "ITAU UNIBANCO S.A",
  tomadorGrossUp: 0.1325,
  tomadorGrossUpOperacao: "+",
  competencia: "09/2026 (Folha)",
  qtdColaboradores: 2,
  rubricas: [rubrica("DIAS NORMAIS", "P", "encargos", 1000), rubrica("CONTRIBUICAO ASSISTENCIAL", "D", "excluido", -50), rubrica("F.G.T.S  DO MES", "FGTS", "excluido", 80)],
  totalDespesas: 1000.004,
  taxaAdministrativa: 100,
  totalFaturaSemEncargos: 1100,
  encargosFatura: { pis: 0, cofins: 0, iss: 0, csll: 0, irrf: 0, total: 150 },
  totalFatura: 1250,
  baseRetencaoInss: 1250,
  retencoes: { irrf: 12.5, csll: 12.5, cofins: 37.5, pis: 8.125, iss: 25, inss: 137.5, total: 233.125 },
  valorLiquido: 1016.875,
  colaboradores: [colaborador(1, "ANA", 625), colaborador(2, "BRUNO", 625)],
};

const entrada = (extra: Partial<EntradaRelatorio> = {}): EntradaRelatorio => ({
  resumo,
  regimeLabel: null,
  ccPorMatricula: new Map([[1, "CC-1"]]),
  deducoes: new Map(),
  vinculoPorMatricula: new Map([[1, { admissao: "2026-01-05", dataDemissao: "2026-09-08", motivoDemissao: "Término do contrato" }]]),
  colaboradorLabel: null,
  ...extra,
});

describe("montarRelatorio", () => {
  it("só inclui nos eventos o que soma faturamento; descontos e informativos vão pra tabela própria", () => {
    const r = montarRelatorio(entrada());
    expect(r.eventos.linhas.map((l) => l[0])).toEqual(["DIAS NORMAIS"]);
    expect(r.eventos.nota).toMatch(/2 evento\(s\)/);
    expect(r.descontos!.linhas.map((l) => [l[0], l[1]])).toEqual([
      ["CONTRIBUICAO ASSISTENCIAL", "Desconto"],
      ["F.G.T.S  DO MES", "Informativo"],
    ]);
  });

  it("valores em reais saem arredondados em centavos", () => {
    const r = montarRelatorio(entrada());
    expect(r.resumo.totais[0]).toMatchObject({ rotulo: "Total de despesas", valor: 1000 });
    expect(r.resumo.retencoes.at(-1)).toMatchObject({ rotulo: "Valor líquido a receber", valor: 1016.88, destaque: true });
  });

  it("colaboradores trazem admissão e rescisão em dd/mm/aaaa e '—' (null) quando não há", () => {
    const r = montarRelatorio(entrada());
    const i = r.colaboradores.colunas.findIndex((c) => c.titulo === "Admissão");
    expect(r.colaboradores.linhas[0].slice(i, i + 2)).toEqual(["05/01/2026", "08/09/2026"]);
    expect(r.colaboradores.linhas[1].slice(i, i + 2)).toEqual([null, null]);
  });

  it("sem deduções não há colunas de dedução; com deduções entram e o líquido cai pelo total deduzido", () => {
    const sem = montarRelatorio(entrada());
    expect(sem.colaboradores.colunas.map((c) => c.titulo)).not.toContain("Adiantamento");

    const com = montarRelatorio(entrada({ deducoes: new Map([[1, { percentual: 20, adiantamento: 100 }]]) }));
    expect(com.colaboradores.colunas.map((c) => c.titulo).slice(-4)).toEqual(["% deduzir", "Adiantamento", "A cobrar", "Deduzido"]);
    // 20% de 625 = 125 + 100 de adiantamento = 225 deduzidos; cobra 400.
    expect(com.colaboradores.linhas[0].slice(-4)).toEqual([20, 100, 400, 225]);
    expect(com.colaboradores.linhas[1].slice(-4)).toEqual([null, null, null, null]);
    expect(com.resumo.retencoes.at(-1)!.valor).toBe(791.88); // 1016,875 − 225
    expect(com.resumo.retencoes.at(-2)).toMatchObject({ rotulo: "Deduções por colaborador (% e adiantamento)", valor: -225 });
    expect(com.resumo.totais.map((l) => l.rotulo)).toContain("do qual adiantamentos");
  });

  it("relatório individual leva o nome no título e a admissão/rescisão (com motivo) no cabeçalho", () => {
    const r = montarRelatorio(
      entrada({
        resumo: { ...resumo, qtdColaboradores: 1, colaboradores: [resumo.colaboradores[0]] },
        colaboradorLabel: "ANA (1)",
      }),
    );
    expect(r.eyebrow).toBe("Relatório de Faturamento individual");
    expect(r.titulo).toBe("ANA (1)");
    expect(r.vinculo).toBe("Admissão: 05/01/2026 · Rescisão: 08/09/2026 (Término do contrato)");
    expect(montarRelatorio(entrada()).vinculo).toBeNull();
  });
});

describe("tipoLabel", () => {
  it("classifica como o PDF", () => {
    expect(tipoLabel("D", "INSS")).toBe("Desconto");
    expect(tipoLabel("R", "FALTAS")).toBe("Desconto");
    expect(tipoLabel("FGTS", "F.G.T.S")).toBe("Informativo");
    expect(tipoLabel("P", "REEMBOLSO VALE")).toBe("Reembolso");
  });
});
