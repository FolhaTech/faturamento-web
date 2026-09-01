import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "../db";
import { getTomador, listTomadores, upsertTomador, upsertTomadoresPendentes } from "./tomadores";

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
