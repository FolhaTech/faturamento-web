import { normalizaTexto } from "../text";
import type { CalculatedLine } from "./engine";
import type { TipoEvento } from "../types";

/**
 * Categorias de benefício excluídas da base de retenção de INSS na fonte
 * (11%), replicando a mesma regra usada no RESUMO real (C53 = TOTAL FATURA
 * - VT/VR/VA/Bonificação). As demais retenções (IRRF, CSLL, COFINS, PIS,
 * ISS) incidem sobre o total cheio da fatura.
 */
const CATEGORIAS_EXCLUIDAS_BASE_INSS = ["VALE TRANSPORTE", "VALE REFEI", "VALE ALIMENTA", "BONIFICA"];

function ehBeneficioExcluidoDaBaseInss(evento: string): boolean {
  const n = normalizaTexto(evento);
  return CATEGORIAS_EXCLUIDAS_BASE_INSS.some((cat) => n.includes(cat));
}

export interface RubricaSomada {
  evento: string;
  /** Tipo do evento (ver TipoEvento) — mesmo evento sempre tem o mesmo tipo, vem da 1ª linha agregada. */
  tipo: TipoEvento;
  /** "excluido" (Tipo D/R = desconto do colaborador, ou FGTS/INSS = restatement) não conta na fatura — ver engine.ts. */
  trilha: CalculatedLine["trilha"];
  qtdLancamentos: number;
  /** Valor de face (DRE) — o que está no arquivo, antes de qualquer encargo. Negativo para Tipo D/R (desconto). */
  valorBruto: number;
  inss: number;
  fgts: number;
  provFerias: number;
  prov13: number;
  /** Encargo trabalhista (INSS) sobre a provisão de férias/13º. */
  encInss: number;
  /** FGTS sobre a provisão de férias/13º. */
  encFgts: number;
  /** Subtotal só das provisões: provFerias + prov13 + encInss + encFgts. */
  totalProvisoes: number;
  /** BASE = valorBruto + inss + fgts + totalProvisoes. */
  despesa: number;
  taxaAdm: number;
  fatura: number;
  impostos: number;
  nf: number;
}

function novaRubrica(evento: string, tipo: TipoEvento, trilha: CalculatedLine["trilha"]): RubricaSomada {
  return {
    evento,
    tipo,
    trilha,
    qtdLancamentos: 0,
    valorBruto: 0,
    inss: 0,
    fgts: 0,
    provFerias: 0,
    prov13: 0,
    encInss: 0,
    encFgts: 0,
    totalProvisoes: 0,
    despesa: 0,
    taxaAdm: 0,
    fatura: 0,
    impostos: 0,
    nf: 0,
  };
}

function somaLinhaNaRubrica(r: RubricaSomada, l: CalculatedLine): void {
  r.qtdLancamentos += 1;
  r.valorBruto += l.dre;
  r.inss += l.inss;
  r.fgts += l.fgts;
  r.provFerias += l.provFerias;
  r.prov13 += l.prov13;
  r.encInss += l.encInss;
  r.encFgts += l.encFgts;
  r.totalProvisoes += l.provFerias + l.prov13 + l.encInss + l.encFgts;
  r.despesa += l.base;
  r.taxaAdm += l.taxaAdmValor;
  r.fatura += l.fatura;
  r.impostos += l.impostos;
  r.nf += l.nf;
}

function agruparPorEvento(lines: CalculatedLine[]): RubricaSomada[] {
  const map = new Map<string, RubricaSomada>();
  for (const l of lines) {
    const r = map.get(l.evento) ?? novaRubrica(l.evento, l.tipo, l.trilha);
    somaLinhaNaRubrica(r, l);
    map.set(l.evento, r);
  }
  return [...map.values()].sort((a, b) => b.despesa - a.despesa);
}

export interface EncargosFatura {
  pis: number;
  cofins: number;
  iss: number;
  csll: number;
  irrf: number;
  total: number;
}

export interface RetencoesFonte {
  irrf: number;
  csll: number;
  cofins: number;
  pis: number;
  inss: number;
  iss: number;
  total: number;
}

export interface ColaboradorResumo {
  matricula: number;
  nome: string;
  despesa: number;
  taxaAdm: number;
  fatura: number;
  impostos: number;
  nf: number;
  rubricas: RubricaSomada[];
}

export interface CcustoResumo {
  /** Eixo de agrupamento da fatura (ver aggregateByCcusto) — vem de dados.cod_ccusto/descricao_ccusto do colaborador. */
  ccustoCodigo: string;
  ccustoNome: string;
  /** Tomador do colaborador (cod_servico) — fonte de FPAS/taxa admin usada no cálculo; só referência aqui, não é mais o eixo de agrupamento. */
  tomadorCodigo: number;
  tomadorNome: string;
  /** Gross Up vigente desse Tomador (ver Tomador.grossUp) — exposto pra tela de Faturamento editar sem round-trip extra. */
  tomadorGrossUp: number;
  competencia: string;
  qtdColaboradores: number;
  rubricas: RubricaSomada[];
  totalDespesas: number;
  taxaAdministrativa: number;
  totalFaturaSemEncargos: number;
  encargosFatura: EncargosFatura;
  totalFatura: number;
  baseRetencaoInss: number;
  retencoes: RetencoesFonte;
  valorLiquido: number;
  colaboradores: ColaboradorResumo[];
}

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + pick(item), 0);
}

/** Agrega as linhas calculadas (já filtradas por competência) em um RESUMO por Centro de Custo, com detalhamento por colaborador. */
export function aggregateByCcusto(lines: CalculatedLine[], competencia: string): CcustoResumo[] {
  const doMes = lines.filter((l) => l.competencia === competencia);

  const porCcusto = new Map<string, CalculatedLine[]>();
  for (const l of doMes) {
    const arr = porCcusto.get(l.ccustoCodigo) ?? [];
    arr.push(l);
    porCcusto.set(l.ccustoCodigo, arr);
  }

  const out: CcustoResumo[] = [];
  for (const [ccustoCodigo, ccustoLines] of porCcusto) {
    const ccustoNome = ccustoLines[0].ccustoNome;
    const tomadorCodigo = ccustoLines[0].tomadorCodigo;
    const tomadorNome = ccustoLines[0].tomadorNome;
    const tomadorGrossUp = ccustoLines[0].tomadorGrossUp;

    const totalDespesas = sum(ccustoLines, (l) => l.base);
    const taxaAdministrativa = sum(ccustoLines, (l) => l.taxaAdmValor);
    const totalFaturaSemEncargos = totalDespesas + taxaAdministrativa;
    const totalFatura = sum(ccustoLines, (l) => l.nf);

    const encargosFatura: EncargosFatura = {
      pis: totalFatura * 0.0165,
      cofins: totalFatura * 0.076,
      iss: totalFatura * 0.02,
      csll: totalFatura * 0.01,
      irrf: totalFatura * 0.01,
      total: 0,
    };
    encargosFatura.total = encargosFatura.pis + encargosFatura.cofins + encargosFatura.iss + encargosFatura.csll + encargosFatura.irrf;

    const faturaExcluidaInss = sum(
      ccustoLines.filter((l) => l.trilha === "beneficio" && ehBeneficioExcluidoDaBaseInss(l.evento)),
      (l) => l.nf,
    );
    const baseRetencaoInss = totalFatura - faturaExcluidaInss;

    const retencoes: RetencoesFonte = {
      irrf: totalFatura * 0.01,
      csll: totalFatura * 0.01,
      cofins: totalFatura * 0.03,
      pis: totalFatura * 0.0065,
      iss: totalFatura * 0.02,
      inss: baseRetencaoInss * 0.11,
      total: 0,
    };
    retencoes.total = retencoes.irrf + retencoes.csll + retencoes.cofins + retencoes.pis + retencoes.iss + retencoes.inss;

    const valorLiquido = totalFatura - retencoes.total;

    const porColaborador = new Map<number, CalculatedLine[]>();
    for (const l of ccustoLines) {
      const arr = porColaborador.get(l.matricula) ?? [];
      arr.push(l);
      porColaborador.set(l.matricula, arr);
    }
    const colaboradores: ColaboradorResumo[] = [...porColaborador.entries()]
      .map(([matricula, ls]) => ({
        matricula,
        nome: ls[0].nome,
        despesa: sum(ls, (l) => l.base),
        taxaAdm: sum(ls, (l) => l.taxaAdmValor),
        fatura: sum(ls, (l) => l.fatura),
        impostos: sum(ls, (l) => l.impostos),
        nf: sum(ls, (l) => l.nf),
        rubricas: agruparPorEvento(ls),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));

    out.push({
      ccustoCodigo,
      ccustoNome,
      tomadorCodigo,
      tomadorNome,
      tomadorGrossUp,
      competencia,
      qtdColaboradores: colaboradores.length,
      rubricas: agruparPorEvento(ccustoLines),
      totalDespesas,
      taxaAdministrativa,
      totalFaturaSemEncargos,
      encargosFatura,
      totalFatura,
      baseRetencaoInss,
      retencoes,
      valorLiquido,
      colaboradores,
    });
  }

  return out.sort((a, b) => a.ccustoNome.localeCompare(b.ccustoNome));
}
