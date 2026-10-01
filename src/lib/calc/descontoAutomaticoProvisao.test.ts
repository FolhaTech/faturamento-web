import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "../db";
import { upsertColaborador, updateDescontoProvisaoFlags } from "../repo/colaboradores";
import { upsertEncargo } from "../repo/encargos";
import { salvarProvisoesMensais } from "../repo/provisoesMensais";
import { upsertTomador } from "../repo/tomadores";
import type { Movimento } from "../types";
import { runEngine } from "./engine";

const TOMADOR_TERCEIRO = { codigo: 1, nome: "GENTER SERVICOS EM RECURSOS HUMANOS LTDA", fpas: 515 as const, taxaAdm: 0.1 };

async function seedBase() {
  await resetDbForTests();
  await upsertTomador(TOMADOR_TERCEIRO);
  await upsertEncargo({
    codigo: 8781,
    evento: "DIAS NORMAIS",
    tipo: "P",
    inss655: 0.255,
    inss515: 0.288,
    fgts: 0.08,
    provFerias: 0.11110833333333332,
    prov13: 0.08333333333333333,
    abateSaldo: null,
  });
  await upsertColaborador({
    matricula: 90103392,
    dados: { cod_epr: 90103392, nome: "ADALBERTO ALVARES JUNIOR", situacao: "Trabalhando", cod_servico: 1, salario: 2000 },
  });
}

beforeEach(async () => {
  await seedBase();
});

describe("runEngine — desconto automático de provisão acumulada", () => {
  it("desconta o acumulado histórico + a provisão da competência atual", async () => {
    // Histórico de provisões em meses anteriores.
    await salvarProvisoesMensais(
      "08/2026 (Folha)",
      new Map([[90103392, { provFerias: 1000, prov13: 800 }]]),
    );

    // Ativa as flags de desconto automático.
    await updateDescontoProvisaoFlags(90103392, { descontarProvFerias: true, descontarProv13: true });

    const movimentos: Movimento[] = [
      {
        id: "1",
        codigo: 8781,
        matricula: 90103392,
        nome: "ADALBERTO ALVARES JUNIOR",
        evento: "DIAS NORMAIS",
        competencia: "09/2026 (Folha)",
        valor: 5000,
        ref: 30,
        tipo: "P",
        forma: "Dias",
      },
    ];

    const { lines } = await runEngine(movimentos);

    const provAtualFerias = 5000 * 0.11110833333333332;
    const provAtual13 = 5000 * 0.08333333333333333;
    const esperadoFerias = 1000 + provAtualFerias;
    const esperado13 = 800 + provAtual13;

    const descontoFerias = lines.find((l) => l.evento === "DESCONTO SALDO DE FÉRIAS");
    const desconto13 = lines.find((l) => l.evento === "DESCONTO SALDO DE 13° SALÁRIO");

    expect(descontoFerias).toBeDefined();
    expect(desconto13).toBeDefined();
    expect(descontoFerias!.dre).toBeCloseTo(-esperadoFerias, 6);
    expect(desconto13!.dre).toBeCloseTo(-esperado13, 6);
  });

  it("lança o desconto uma única vez mesmo com várias competências no mesmo upload", async () => {
    await updateDescontoProvisaoFlags(90103392, { descontarProvFerias: true, descontarProv13: true });

    const mov = (id: string, competencia: string): Movimento => ({
      id,
      codigo: 8781,
      matricula: 90103392,
      nome: "ADALBERTO ALVARES JUNIOR",
      evento: "DIAS NORMAIS",
      competencia,
      valor: 5000,
      ref: 30,
      tipo: "P",
      forma: "Dias",
    });

    const { lines } = await runEngine([mov("1", "08/2026 (Folha)"), mov("2", "09/2026 (Folha)")]);

    const descontos = lines.filter((l) => l.evento === "DESCONTO SALDO DE FÉRIAS" || l.evento === "DESCONTO SALDO DE 13° SALÁRIO");
    expect(descontos).toHaveLength(2);
    expect(new Set(descontos.map((d) => d.competencia)).size).toBe(1);
  });

  it("marcar a flag como Não remove o desconto automático já lançado", async () => {
    await updateDescontoProvisaoFlags(90103392, { descontarProvFerias: true, descontarProv13: true });

    const movimentos: Movimento[] = [
      {
        id: "1",
        codigo: 8781,
        matricula: 90103392,
        nome: "ADALBERTO ALVARES JUNIOR",
        evento: "DIAS NORMAIS",
        competencia: "09/2026 (Folha)",
        valor: 5000,
        ref: 30,
        tipo: "P",
        forma: "Dias",
      },
    ];
    const ehDesconto = (evento: string) => evento === "DESCONTO SALDO DE FÉRIAS" || evento === "DESCONTO SALDO DE 13° SALÁRIO";

    const antes = await runEngine(movimentos);
    expect(antes.lines.filter((l) => ehDesconto(l.evento))).toHaveLength(2);

    const colaborador = await updateDescontoProvisaoFlags(90103392, { descontarProvFerias: false, descontarProv13: false });
    expect(colaborador.descontoProvFeriasCompetencia).toBeNull();
    expect(colaborador.descontoProv13Competencia).toBeNull();

    const depois = await runEngine(movimentos);
    expect(depois.lines.filter((l) => ehDesconto(l.evento))).toHaveLength(0);
  });

  it("abate descontos de saldo já lançados do acumulado", async () => {
    // Histórico de provisões.
    await salvarProvisoesMensais(
      "08/2026 (Folha)",
      new Map([[90103392, { provFerias: 1000, prov13: 800 }]]),
    );

    // Já existe um desconto de saldo anterior (ex.: lançado manualmente em outra competência).
    const { lancarDescontoSaldoFerias } = await import("./descontoSaldoFerias");
    await lancarDescontoSaldoFerias({ matricula: 90103392, nome: "ADALBERTO ALVARES JUNIOR" }, "07/2026 (Folha)", 200, 150);

    // Ativa as flags de desconto automático.
    await updateDescontoProvisaoFlags(90103392, { descontarProvFerias: true, descontarProv13: true });

    const movimentos: Movimento[] = [
      {
        id: "1",
        codigo: 8781,
        matricula: 90103392,
        nome: "ADALBERTO ALVARES JUNIOR",
        evento: "DIAS NORMAIS",
        competencia: "09/2026 (Folha)",
        valor: 5000,
        ref: 30,
        tipo: "P",
        forma: "Dias",
      },
    ];

    const { lines } = await runEngine(movimentos);

    const provAtualFerias = 5000 * 0.11110833333333332;
    const provAtual13 = 5000 * 0.08333333333333333;
    const esperadoFerias = 1000 + provAtualFerias - 200;
    const esperado13 = 800 + provAtual13 - 150;

    const descontoFerias = lines.find((l) => l.evento === "DESCONTO SALDO DE FÉRIAS");
    const desconto13 = lines.find((l) => l.evento === "DESCONTO SALDO DE 13° SALÁRIO");

    expect(descontoFerias!.dre).toBeCloseTo(-esperadoFerias, 6);
    expect(desconto13!.dre).toBeCloseTo(-esperado13, 6);
  });
});
