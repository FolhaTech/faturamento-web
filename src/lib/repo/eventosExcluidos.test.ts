import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "../db";
import { chaveEventoExcluido, excluirEvento, listEventosExcluidos, listEventosExcluidosKeys, restaurarEvento } from "./eventosExcluidos";

beforeEach(async () => {
  await resetDbForTests();
});

describe("eventosExcluidos repo — evento excluído manualmente da fatura de UM colaborador", () => {
  it("listEventosExcluidos retorna vazio quando nada foi excluído", async () => {
    expect(await listEventosExcluidos("01/2026")).toEqual([]);
  });

  it("excluirEvento marca o evento como excluído pra esse colaborador nessa competência", async () => {
    await excluirEvento(1, "01/2026", "HORAS EXTRAS 50%");
    const lista = await listEventosExcluidos("01/2026");
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ matricula: 1, competencia: "01/2026", evento: "HORAS EXTRAS 50%" });
    expect(new Date(lista[0].excluidoEm).getTime()).not.toBeNaN();
  });

  it("excluir de novo o mesmo evento não duplica (ON CONFLICT DO NOTHING)", async () => {
    await excluirEvento(1, "01/2026", "HORAS EXTRAS 50%");
    await excluirEvento(1, "01/2026", "HORAS EXTRAS 50%");
    expect(await listEventosExcluidos("01/2026")).toHaveLength(1);
  });

  it("excluir o mesmo evento em colaboradores diferentes fica independente", async () => {
    await excluirEvento(1, "01/2026", "HORAS EXTRAS 50%");
    await excluirEvento(2, "01/2026", "HORAS EXTRAS 50%");
    expect(await listEventosExcluidos("01/2026")).toHaveLength(2);
  });

  it("listEventosExcluidosKeys retorna as chaves no formato usado por filtrarEventosExcluidos", async () => {
    await excluirEvento(1, "01/2026", "HORAS EXTRAS 50%");
    const keys = await listEventosExcluidosKeys("01/2026");
    expect(keys.has(chaveEventoExcluido(1, "HORAS EXTRAS 50%"))).toBe(true);
    expect(keys.has(chaveEventoExcluido(2, "HORAS EXTRAS 50%"))).toBe(false);
  });

  it("restaurarEvento desfaz a exclusão", async () => {
    await excluirEvento(1, "01/2026", "HORAS EXTRAS 50%");
    await restaurarEvento(1, "01/2026", "HORAS EXTRAS 50%");
    expect(await listEventosExcluidos("01/2026")).toEqual([]);
  });

  it("listEventosExcluidos só traz da competência pedida", async () => {
    await excluirEvento(1, "01/2026", "HORAS EXTRAS 50%");
    await excluirEvento(1, "02/2026", "HORAS EXTRAS 50%");
    const lista = await listEventosExcluidos("01/2026");
    expect(lista).toHaveLength(1);
    expect(lista[0].competencia).toBe("01/2026");
  });
});
