import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "../db";
import { createInformativa, findInformativaByEvento, listInformativas } from "./informativas";

beforeEach(async () => {
  await resetDbForTests();
});

describe("informativas repo — findInformativaByEvento", () => {
  it("encontra por nome ignorando acento e caixa (evita duplicar em reimportações)", async () => {
    await createInformativa({ codigo: 327, evento: "SEGURO DE VIDA FORNECIDO*", valor: 5.5, recorrencia: "VALOR FIXO MENSAL", inicio: null, obs: null });

    expect(await findInformativaByEvento("Seguro de Vida Fornecido*")).not.toBeNull();
    expect(await findInformativaByEvento("SEGURO DE VIDA FORNECIDO*")).not.toBeNull();
    expect(await findInformativaByEvento("  seguro de vida fornecido*  ")).not.toBeNull();
    expect(await findInformativaByEvento("Crachá")).toBeNull();

    expect(await listInformativas()).toHaveLength(1);
  });
});
