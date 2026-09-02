import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "../db";
import { getTomador, listTomadores, updateGrossUp, upsertTomador, upsertTomadoresPendentes } from "./tomadores";

beforeEach(async () => {
  await resetDbForTests();
});

describe("tomadores repo — cadastro pendente (Cód Serviço sem Tomador cadastrado)", () => {
  it("cria um cadastro mínimo pendente usando o nome sugerido", async () => {
    const [criado] = await upsertTomadoresPendentes([{ codigo: 999, nomeSugerido: "EMPRESA NOVA LTDA" }]);
    expect(criado.pendente).toBe(true);
    expect(criado.nome).toBe("EMPRESA NOVA LTDA");
    expect(criado.fpas).toBe(655);
    expect(criado.taxaAdm).toBe(0);
  });

  it("usa um rótulo genérico quando não há nome sugerido", async () => {
    const [criado] = await upsertTomadoresPendentes([{ codigo: 999, nomeSugerido: null }]);
    expect(criado.nome).toMatch(/999/);
    expect(criado.nome).toMatch(/pendente/i);
  });

  it("não sobrescreve um tomador já cadastrado (mesmo que pendente) — não duplica nem reseta dados reais", async () => {
    await upsertTomador({ codigo: 999, nome: "EMPRESA REAL LTDA", fpas: 515, taxaAdm: 0.1 });
    await upsertTomadoresPendentes([{ codigo: 999, nomeSugerido: "outro nome qualquer" }]);

    const t = (await getTomador(999))!;
    expect(t.nome).toBe("EMPRESA REAL LTDA");
    expect(t.pendente).toBe(false);
    expect((await listTomadores()).length).toBe(1);
  });

  it("salvar dados reais (upsertTomador) zera o pendente mesmo para um tomador criado automaticamente", async () => {
    await upsertTomadoresPendentes([{ codigo: 999, nomeSugerido: null }]);
    await upsertTomador({ codigo: 999, nome: "EMPRESA REAL LTDA", fpas: 515, taxaAdm: 0.1 });

    const t = (await getTomador(999))!;
    expect(t.pendente).toBe(false);
    expect(t.nome).toBe("EMPRESA REAL LTDA");
  });
});

describe("tomadores repo — Gross Up", () => {
  it("usa 0,8675 como padrão quando não informado", async () => {
    await upsertTomador({ codigo: 999, nome: "EMPRESA LTDA", fpas: 515, taxaAdm: 0.1 });
    const t = (await getTomador(999))!;
    expect(t.grossUp).toBeCloseTo(0.8675, 6);
  });

  it("grava o Gross Up informado no upsert completo", async () => {
    await upsertTomador({ codigo: 999, nome: "EMPRESA LTDA", fpas: 515, taxaAdm: 0.1, grossUp: 0.9 });
    const t = (await getTomador(999))!;
    expect(t.grossUp).toBeCloseTo(0.9, 6);
  });

  it("aceita e preserva 0 (não cai no padrão 0,8675) — 0 significa gross-up desligado", async () => {
    await upsertTomador({ codigo: 999, nome: "EMPRESA LTDA", fpas: 515, taxaAdm: 0.1, grossUp: 0 });
    const t = (await getTomador(999))!;
    expect(t.grossUp).toBe(0);
  });

  it("updateGrossUp atualiza só o Gross Up, sem mexer nos demais campos", async () => {
    await upsertTomador({ codigo: 999, nome: "EMPRESA LTDA", fpas: 515, taxaAdm: 0.1 });
    await updateGrossUp(999, 0.9);

    const t = (await getTomador(999))!;
    expect(t.grossUp).toBeCloseTo(0.9, 6);
    expect(t.nome).toBe("EMPRESA LTDA");
    expect(t.fpas).toBe(515);
    expect(t.taxaAdm).toBeCloseTo(0.1, 6);
  });
});
