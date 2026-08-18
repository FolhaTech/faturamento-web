import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "../db";
import { createInformativa, findInformativaByEvento, listInformativas } from "./informativas";

beforeEach(() => {
  resetDbForTests();
});

describe("informativas repo — findInformativaByEvento", () => {
  it("encontra por nome ignorando acento e caixa (evita duplicar em reimportações)", () => {
    createInformativa({ codigo: 327, evento: "SEGURO DE VIDA FORNECIDO*", valor: 5.5, recorrencia: "VALOR FIXO MENSAL", inicio: null, obs: null });

    expect(findInformativaByEvento("Seguro de Vida Fornecido*")).not.toBeNull();
    expect(findInformativaByEvento("SEGURO DE VIDA FORNECIDO*")).not.toBeNull();
    expect(findInformativaByEvento("  seguro de vida fornecido*  ")).not.toBeNull();
    expect(findInformativaByEvento("Crachá")).toBeNull();

    expect(listInformativas()).toHaveLength(1);
  });
});
