import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "../db";
import { upsertColaborador } from "../repo/colaboradores";
import { upsertEncargo } from "../repo/encargos";
import { createInformativa } from "../repo/informativas";
import { upsertTomador } from "../repo/tomadores";
import type { Movimento } from "../types";
import { buildContext, calculateLine, runEngine } from "./engine";

const TOMADOR_TERCEIRO = { codigo: 1, nome: "GENTER SERVICOS EM RECURSOS HUMANOS LTDA", fpas: 515 as const, taxaAdm: 0.1 };
const TOMADOR_TEMPORARIO = { codigo: 36, nome: "GRUPO CHAMA DE DISTRIBUICAO LTDA", fpas: 655 as const, taxaAdm: 0.12 };

function seedBase() {
  resetDbForTests();
  upsertTomador(TOMADOR_TERCEIRO);
  upsertTomador(TOMADOR_TEMPORARIO);
  upsertEncargo({
    codigo: 8781,
    evento: "DIAS NORMAIS",
    tipo: "P",
    inss655: 0.255,
    inss515: 0.288,
    fgts: 0.08,
    provFerias: 0.11110833333333332,
    prov13: 0.08333333333333333,
  });
  upsertEncargo({ codigo: 48, evento: "VALE TRANSPORTE", tipo: "D", inss655: 0, inss515: 0, fgts: 0, provFerias: 0, prov13: 0 });
  upsertColaborador({
    matricula: 90103392,
    dados: { cod_epr: 90103392, nome: "ADALBERTO ALVARES JUNIOR", situacao: "Trabalhando", cod_servico: 1, salario: 2000 },
  });
}

beforeEach(() => {
  seedBase();
});

describe("calculateLine — trilha de encargos (proventos/descontos)", () => {
  it("aplica INSS 515 (Terceiro), FGTS e provisões corretas sobre um provento", () => {
    const mov: Movimento = {
      id: "1",
      codigo: 8781,
      matricula: 90103392,
      nome: "ADALBERTO ALVARES JUNIOR",
      evento: "DIAS NORMAIS",
      competencia: "01/2026",
      valor: 999.86,
      ref: 12,
      tipo: "P",
      forma: "Dias",
    };
    const ctx = buildContext([mov]);

    const { line, warning } = calculateLine(mov, ctx);
    expect(warning).toBeNull();
    const l = line!;

    expect(l.dre).toBeCloseTo(999.86, 6);
    expect(l.inss).toBeCloseTo(999.86 * 0.288, 6); // FPAS 515 -> coluna INSS 515
    expect(l.fgts).toBeCloseTo(999.86 * 0.08, 6);
    expect(l.provFerias).toBeCloseTo(999.86 * 0.11110833333333332, 6);
    expect(l.prov13).toBeCloseTo(999.86 * 0.08333333333333333, 6);
    // regime Terceiro: encargo incide sobre (Prov. Férias + Prov. 13º), nas mesmas alíquotas de INSS 515 / FGTS
    expect(l.encInss).toBeCloseTo((l.provFerias + l.prov13) * 0.288, 6);
    expect(l.encFgts).toBeCloseTo((l.provFerias + l.prov13) * 0.08, 6);
    expect(l.base).toBeCloseTo(l.dre + l.inss + l.fgts + l.provFerias + l.prov13 + l.encInss + l.encFgts, 6);

    expect(l.taxaAdmValor).toBeCloseTo(l.base * 0.1, 6);
    expect(l.fatura).toBeCloseTo(l.base + l.taxaAdmValor, 6);
    expect(l.nf).toBeCloseTo(l.fatura / 0.8675, 6);
    expect(l.trilha).toBe("encargos");
  });

  it("usa INSS 655 e encargo sobre provisão baseado só na Prov. 13º quando o tomador é FPAS 655 (Temporario)", () => {
    upsertColaborador({
      matricula: 1,
      dados: { cod_epr: 1, nome: "FULANO", situacao: "Trabalhando", cod_servico: TOMADOR_TEMPORARIO.codigo },
    });
    const mov: Movimento = {
      id: "1",
      codigo: 8781,
      matricula: 1,
      nome: "FULANO",
      evento: "DIAS NORMAIS",
      competencia: "07/2026",
      valor: 1000,
      ref: 30,
      tipo: "P",
      forma: "Dias",
    };
    const ctx = buildContext([mov]);
    const { line } = calculateLine(mov, ctx);
    const l = line!;
    expect(l.inss).toBeCloseTo(1000 * 0.255, 6);
    // regime Temporario: encargo incide só sobre a Prov. 13º, nas mesmas alíquotas de INSS 655 / FGTS
    expect(l.encInss).toBeCloseTo(l.prov13 * 0.255, 6);
    expect(l.encFgts).toBeCloseTo(l.prov13 * 0.08, 6);
    expect(l.taxaAdmValor).toBeCloseTo(l.base * 0.12, 6);
  });

});

describe("calculateLine — desconto (Tipo D) não entra na soma do faturamento", () => {
  it("mantém o DRE negativo para referência, mas zera base/taxa/fatura/NF", () => {
    const mov: Movimento = {
      id: "1",
      codigo: 48,
      matricula: 90103392,
      nome: "ADALBERTO ALVARES JUNIOR",
      evento: "VALE TRANSPORTE",
      competencia: "01/2026",
      valor: 100,
      ref: 100,
      tipo: "D",
      forma: "Valor",
    };
    const ctx = buildContext([mov]);
    const { line, warning } = calculateLine(mov, ctx);
    expect(warning).toBeNull();
    const l = line!;
    expect(l.trilha).toBe("excluido");
    expect(l.dre).toBe(-100); // referência: valor descontado do holerite do colaborador
    expect(l.inss).toBe(0);
    expect(l.base).toBe(0);
    expect(l.taxaAdmValor).toBe(0);
    expect(l.fatura).toBe(0);
    expect(l.nf).toBe(0);
  });
});

describe("calculateLine — trilha de benefício em espécie (Tipo I / R)", () => {
  it("cobra vale-refeição fornecido pelo valor de face + taxa adm, sem encargos", () => {
    const mov: Movimento = {
      id: "1",
      codigo: 322,
      matricula: 90103392,
      nome: "ADALBERTO ALVARES JUNIOR",
      evento: "VALE REFEICAO FORNECIDO*",
      competencia: "01/2026",
      valor: 315,
      ref: 315,
      tipo: "I",
      forma: "Valor",
    };
    const ctx = buildContext([mov]);
    const { line, warning } = calculateLine(mov, ctx);
    expect(warning).toBeNull();
    const l = line!;
    expect(l.trilha).toBe("beneficio");
    expect(l.inss).toBe(0);
    expect(l.base).toBe(315);
    expect(l.taxaAdmValor).toBeCloseTo(315 * 0.1, 6);
    expect(l.fatura).toBeCloseTo(315 * 1.1, 6);
    expect(l.nf).toBeCloseTo((315 * 1.1) / 0.8675, 6);
  });
});

describe("calculateLine — linhas de restatement (Tipo FGTS / INSS)", () => {
  it("exclui do faturamento uma linha informativa de FGTS do mês (já refletida no provento)", () => {
    const mov: Movimento = {
      id: "1",
      codigo: 996,
      matricula: 90103392,
      nome: "ADALBERTO ALVARES JUNIOR",
      evento: "F.G.T.S DO MES",
      competencia: "01/2026",
      valor: 79.98,
      ref: 0,
      tipo: "FGTS",
      forma: "Valor",
    };
    const ctx = buildContext([mov]);
    const { line } = calculateLine(mov, ctx);
    const l = line!;
    expect(l.trilha).toBe("excluido");
    expect(l.base).toBe(0);
    expect(l.nf).toBe(0);
  });

  it("usa o tipo cadastrado em Encargos mesmo quando o arquivo do mês marca a linha com outro Tipo (evita duplicar o FGTS já embutido no provento)", () => {
    // Caso real: Movimentos072026.xls traz "F.G.T.S DO MES" (cód. 996) com
    // Tipo="I" na coluna G, mas o código já está cadastrado em Encargos como
    // tipo="FGTS" — tem que prevalecer o cadastro, não a coluna do arquivo.
    upsertEncargo({ codigo: 996, evento: "F.G.T.S  DO MES", tipo: "FGTS", inss655: 0, inss515: 0, fgts: 0, provFerias: 0, prov13: 0 });
    const mov: Movimento = {
      id: "1",
      codigo: 996,
      matricula: 90103392,
      nome: "ADALBERTO ALVARES JUNIOR",
      evento: "F.G.T.S DO MES",
      competencia: "07/2026",
      valor: 99.73,
      ref: 0,
      tipo: "I", // como vem no arquivo real, apesar de já ser FGTS no cadastro
      forma: "Valor",
    };
    const ctx = buildContext([mov]);
    const { line } = calculateLine(mov, ctx);
    const l = line!;
    expect(l.trilha).toBe("excluido");
    expect(l.tipo).toBe("FGTS");
    expect(l.base).toBe(0);
    expect(l.fatura).toBe(0);
    expect(l.nf).toBe(0);
  });
});

describe("calculateLine — dados ausentes geram avisos em vez de derrubar o cálculo", () => {
  it("matrícula sem cadastro em Colaboradores gera aviso e a linha é ignorada", () => {
    const mov: Movimento = {
      id: "1",
      codigo: 8781,
      matricula: 999999,
      nome: "FULANO INEXISTENTE",
      evento: "DIAS NORMAIS",
      competencia: "01/2026",
      valor: 100,
      ref: 1,
      tipo: "P",
      forma: "Dias",
    };
    const ctx = buildContext([mov]);
    const { line, warning } = calculateLine(mov, ctx);
    expect(line).toBeNull();
    expect(warning).toMatch(/999999/);
  });

  it("evento sem alíquota em Encargos ainda gera BASE = valor (sem encargo), com aviso", () => {
    const mov: Movimento = {
      id: "1",
      codigo: 424242,
      matricula: 90103392,
      nome: "ADALBERTO ALVARES JUNIOR",
      evento: "EVENTO DESCONHECIDO",
      competencia: "01/2026",
      valor: 50,
      ref: 1,
      tipo: "P",
      forma: "Valor",
    };
    const ctx = buildContext([mov]);
    const { line, warning } = calculateLine(mov, ctx);
    expect(warning).toMatch(/424242/);
    expect(line!.base).toBe(50);
  });
});

describe("runEngine — benefícios de Informativas com recorrência fixa", () => {
  const movimentosBase: Movimento[] = [
    {
      id: "1",
      codigo: 8781,
      matricula: 90103392,
      nome: "ADALBERTO ALVARES JUNIOR",
      evento: "DIAS NORMAIS",
      competencia: "08/2026",
      valor: 1000,
      ref: 30,
      tipo: "P",
      forma: "Dias",
    },
  ];

  it("gera cobrança de Ponto Eletrônico para colaboradores ativos quando o evento não existe em Movimentos", () => {
    createInformativa({ codigo: null, evento: "PONTO ELETRÔNICO*", valor: 7, recorrencia: "VALOR FIXO MENSAL", inicio: null, obs: null });
    createInformativa({ codigo: null, evento: "COMPUTADOR*", valor: 0, recorrencia: "VALOR FIXO MENSAL", inicio: null, obs: null });

    const { lines, warnings } = runEngine(movimentosBase);
    const ponto = lines.find((l) => l.evento === "PONTO ELETRÔNICO*");
    expect(ponto).toBeDefined();
    expect(ponto!.base).toBe(7);
    expect(ponto!.matricula).toBe(90103392);
    expect(warnings.some((w) => w.includes("COMPUTADOR*"))).toBe(true);
  });

  it("não duplica quando o colaborador já tem lançamento real para a mesma categoria no mês", () => {
    createInformativa({ codigo: 327, evento: "SEGURO DE VIDA FORNECIDO*", valor: 999, recorrencia: "VALOR FIXO MENSAL", inicio: null, obs: null });

    const { lines } = runEngine([
      ...movimentosBase,
      {
        id: "2",
        codigo: 327,
        matricula: 90103392,
        nome: "ADALBERTO ALVARES JUNIOR",
        evento: "SEGURO DE VIDA FORNECIDO*",
        competencia: "08/2026",
        valor: 5.5,
        ref: 5.5,
        tipo: "I",
        forma: "Valor",
      },
    ]);
    const seguros = lines.filter((l) => l.evento.toUpperCase().includes("SEGURO DE VIDA"));
    expect(seguros).toHaveLength(1);
    expect(seguros[0].base).toBe(5.5);
  });
});
