import { beforeEach, describe, expect, it } from "vitest";
import type { CalculatedLine } from "../calc/engine";
import { resetDbForTests } from "../db";
import {
  descartarFaturaSalva,
  getFaturaSalvaDoUsuario,
  listCompetenciasComFaturaSalva,
  listMinhasCompetenciasComFaturaSalva,
  listTimelineFaturas,
  salvarFatura,
} from "./faturasSalvas";
import { replaceMovimentosPorCompetencia, type MovimentoInput } from "./movimentos";

beforeEach(async () => {
  await resetDbForTests();
});

const ALICE = { email: "alice@folhate.com.br", nome: "Alice" };
const BOB = { email: "bob@folhate.com.br", nome: "Bob" };

function linha(overrides: Partial<CalculatedLine> = {}): CalculatedLine {
  return {
    matricula: 1,
    nome: "FULANO",
    codigo: 8781,
    evento: "DIAS NORMAIS",
    competencia: "01/2026",
    tipo: "P",
    tomadorCodigo: 1,
    tomadorNome: "TOMADOR TESTE",
    fpas: 515,
    tomadorGrossUp: 0.1325,
    tomadorGrossUpOperacao: "+",
    ccustoCodigo: "10",
    ccustoNome: "OBRA 10",
    trilha: "encargos",
    dre: 1000,
    inss: 288,
    fgts: 80,
    provFerias: 111.11,
    prov13: 83.33,
    encInss: 55.99,
    encFgts: 15.55,
    base: 1633.98,
    taxaAdmValor: 163.4,
    fatura: 1797.38,
    impostos: 238.16,
    nf: 2035.54,
    ...overrides,
  };
}

describe("faturasSalvas repo — timeline de fotos congeladas do faturamento, por usuário", () => {
  it("getFaturaSalvaDoUsuario retorna null quando esse usuário ainda não salvou a competência", async () => {
    expect(await getFaturaSalvaDoUsuario("01/2026", ALICE.email)).toBeNull();
  });

  it("salva e lê de volta as lines e warnings sem perder dados no round-trip JSON", async () => {
    const lines = [linha(), linha({ matricula: 2, evento: "HORAS EXTRAS 50%", nf: 42.5 })];
    const warnings = ["aviso 1", "aviso 2"];

    await salvarFatura("01/2026", ALICE, lines, warnings, []);
    const salva = await getFaturaSalvaDoUsuario("01/2026", ALICE.email);

    expect(salva).not.toBeNull();
    expect(salva!.usuarioEmail).toBe(ALICE.email);
    expect(salva!.usuarioNome).toBe(ALICE.nome);
    expect(salva!.lines).toHaveLength(2);
    expect(salva!.lines[1].evento).toBe("HORAS EXTRAS 50%");
    expect(salva!.lines[1].nf).toBeCloseTo(42.5, 6);
    expect(salva!.warnings).toEqual(warnings);
    expect(salva!.descartada).toBe(false);
    expect(salva!.previaTotalFaturaPorCcusto).toEqual([]);
    expect(new Date(salva!.salvoEm).getTime()).not.toBeNaN();
  });

  it("salva e lê de volta o total da Prévia congelado por Ccusto", async () => {
    await salvarFatura("01/2026 (Folha)", ALICE, [linha()], [], [{ ccustoCodigo: "10", totalFatura: 2035.54 }]);
    const salva = await getFaturaSalvaDoUsuario("01/2026 (Folha)", ALICE.email);
    expect(salva!.previaTotalFaturaPorCcusto).toEqual([{ ccustoCodigo: "10", totalFatura: 2035.54 }]);
  });

  it("dois usuários salvando a mesma competência não se sobrescrevem — cada um vê a própria versão", async () => {
    await salvarFatura("01/2026", ALICE, [linha()], ["aviso da alice"], []);
    await salvarFatura("01/2026", BOB, [linha(), linha({ matricula: 2 })], ["aviso do bob"], []);

    const daAlice = await getFaturaSalvaDoUsuario("01/2026", ALICE.email);
    const doBob = await getFaturaSalvaDoUsuario("01/2026", BOB.email);

    expect(daAlice!.lines).toHaveLength(1);
    expect(daAlice!.warnings).toEqual(["aviso da alice"]);
    expect(doBob!.lines).toHaveLength(2);
    expect(doBob!.warnings).toEqual(["aviso do bob"]);
  });

  it("salvar de novo pra mesma competência e usuário cria uma NOVA entrada (não sobrescreve) e vira a versão ativa", async () => {
    await salvarFatura("01/2026", ALICE, [linha()], [], []);
    await new Promise((r) => setTimeout(r, 5));
    await salvarFatura("01/2026", ALICE, [linha(), linha({ matricula: 2 })], ["novo aviso"], [{ ccustoCodigo: "10", totalFatura: 500 }]);

    const ativa = await getFaturaSalvaDoUsuario("01/2026", ALICE.email);
    expect(ativa!.lines).toHaveLength(2);
    expect(ativa!.warnings).toEqual(["novo aviso"]);
    expect(ativa!.previaTotalFaturaPorCcusto).toEqual([{ ccustoCodigo: "10", totalFatura: 500 }]);

    const timeline = await listTimelineFaturas("01/2026");
    expect(timeline).toHaveLength(2);
  });

  it("descartarFaturaSalva volta o usuário pro cálculo ao vivo sem apagar a entrada (fica na timeline)", async () => {
    await salvarFatura("01/2026", ALICE, [linha()], [], []);
    await descartarFaturaSalva("01/2026", ALICE.email);

    expect(await getFaturaSalvaDoUsuario("01/2026", ALICE.email)).toBeNull();
    const timeline = await listTimelineFaturas("01/2026");
    expect(timeline).toHaveLength(1);
    expect(timeline[0].descartada).toBe(true);
  });

  it("descartar não afeta a versão de outro usuário", async () => {
    await salvarFatura("01/2026", ALICE, [linha()], [], []);
    await salvarFatura("01/2026", BOB, [linha()], [], []);

    await descartarFaturaSalva("01/2026", ALICE.email);

    expect(await getFaturaSalvaDoUsuario("01/2026", ALICE.email)).toBeNull();
    expect(await getFaturaSalvaDoUsuario("01/2026", BOB.email)).not.toBeNull();
  });

  it("listTimelineFaturas traz tudo, mais recente primeiro, inclusive descartadas", async () => {
    await salvarFatura("01/2026", ALICE, [linha()], [], []);
    await new Promise((r) => setTimeout(r, 5));
    await salvarFatura("01/2026", BOB, [linha()], [], []);
    await descartarFaturaSalva("01/2026", ALICE.email);

    const timeline = await listTimelineFaturas("01/2026");
    expect(timeline).toHaveLength(2);
    expect(timeline[0].usuarioEmail).toBe(BOB.email);
    expect(timeline[1].usuarioEmail).toBe(ALICE.email);
    expect(timeline[1].descartada).toBe(true);
  });

  it("listMinhasCompetenciasComFaturaSalva só retorna as competências com versão ativa DESSE usuário", async () => {
    await salvarFatura("01/2026", ALICE, [linha()], [], []);
    await salvarFatura("02/2026", BOB, [linha()], [], []);

    const daAlice = await listMinhasCompetenciasComFaturaSalva(["01/2026", "02/2026"], ALICE.email);
    expect(daAlice.has("01/2026")).toBe(true);
    expect(daAlice.has("02/2026")).toBe(false);
  });

  it("listCompetenciasComFaturaSalva retorna a competência se QUALQUER usuário tiver versão ativa", async () => {
    await salvarFatura("01/2026", ALICE, [linha()], [], []);
    const resultado = await listCompetenciasComFaturaSalva(["01/2026", "02/2026"]);
    expect(resultado.has("01/2026")).toBe(true);
    expect(resultado.has("02/2026")).toBe(false);
  });

  it("reenviar o arquivo de Movimentos daquela competência descarta as faturas salvas de TODOS os usuários", async () => {
    const mov: MovimentoInput = {
      codigo: 8781,
      matricula: 1,
      nome: "FULANO",
      evento: "DIAS NORMAIS",
      competencia: "01/2026",
      valor: 1000,
      ref: 30,
      tipo: "P",
      forma: "Dias",
    };
    await replaceMovimentosPorCompetencia([mov]);
    await salvarFatura("01/2026", ALICE, [linha()], [], []);
    await salvarFatura("01/2026", BOB, [linha()], [], []);
    expect(await getFaturaSalvaDoUsuario("01/2026", ALICE.email)).not.toBeNull();
    expect(await getFaturaSalvaDoUsuario("01/2026", BOB.email)).not.toBeNull();

    // Reenvio: substitui as linhas de Movimentos da mesma competência.
    await replaceMovimentosPorCompetencia([mov]);
    expect(await getFaturaSalvaDoUsuario("01/2026", ALICE.email)).toBeNull();
    expect(await getFaturaSalvaDoUsuario("01/2026", BOB.email)).toBeNull();

    // Descartada, não apagada — continua na timeline.
    const timeline = await listTimelineFaturas("01/2026");
    expect(timeline).toHaveLength(2);
    expect(timeline.every((f) => f.descartada)).toBe(true);
  });

  it("reenviar Movimentos de OUTRA competência não mexe na fatura salva desta", async () => {
    await salvarFatura("01/2026", ALICE, [linha()], [], []);
    await replaceMovimentosPorCompetencia([
      {
        codigo: 8781,
        matricula: 1,
        nome: "FULANO",
        evento: "DIAS NORMAIS",
        competencia: "02/2026",
        valor: 1000,
        ref: 30,
        tipo: "P",
        forma: "Dias",
      },
    ]);
    expect(await getFaturaSalvaDoUsuario("01/2026", ALICE.email)).not.toBeNull();
  });
});
