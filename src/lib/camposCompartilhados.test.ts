import { describe, expect, it } from "vitest";
import { aplicarAlteracao, camposVazios, ehCampo, lerCamposSalvos, mesclarComPendentes, valoresFaltandoNoServidor } from "./camposCompartilhados";

describe("lerCamposSalvos", () => {
  it("devolve null quando a versão salva não tem os valores guardados (versão antiga) ou o JSON é inválido", () => {
    expect(lerCamposSalvos(null)).toBeNull();
    expect(lerCamposSalvos(undefined)).toBeNull();
    expect(lerCamposSalvos("")).toBeNull();
    expect(lerCamposSalvos("{nao é json")).toBeNull();
    expect(lerCamposSalvos("[]")).toBeNull();
    expect(lerCamposSalvos("42")).toBeNull();
    expect(lerCamposSalvos("null")).toBeNull();
  });

  it("lê o que foi guardado ao salvar", () => {
    const guardado = JSON.stringify({ percentual: { "90103375": "20,5" }, adiantamento: { "90103375": "1.500,00" }, base: { "0001": "9.274,42" } });
    expect(lerCamposSalvos(guardado)).toEqual({ percentual: { "90103375": "20,5" }, adiantamento: { "90103375": "1.500,00" }, base: { "0001": "9.274,42" } });
  });

  it("um JSON vazio é uma foto válida de 'nada digitado' (diferente de não ter foto)", () => {
    expect(lerCamposSalvos("{}")).toEqual({ percentual: {}, adiantamento: {}, base: {} });
  });

  it("ignora campos desconhecidos, valores vazios e o que não é texto", () => {
    const guardado = JSON.stringify({ percentual: { "1": "10", "2": "", "3": "  ", "4": 5, "5": null }, adiantamento: "lixo", outro: { "1": "x" } });
    expect(lerCamposSalvos(guardado)).toEqual({ percentual: { "1": "10" }, adiantamento: {}, base: {} });
  });
});

describe("ehCampo / camposVazios", () => {
  it("aceita só os três campos conhecidos", () => {
    expect(ehCampo("percentual")).toBe(true);
    expect(ehCampo("adiantamento")).toBe(true);
    expect(ehCampo("base")).toBe(true);
    expect(ehCampo("outro")).toBe(false);
    expect(ehCampo(undefined)).toBe(false);
    expect(ehCampo(3)).toBe(false);
  });

  it("camposVazios devolve objetos independentes a cada chamada", () => {
    const a = camposVazios();
    a.percentual["1"] = "10";
    expect(camposVazios().percentual).toEqual({});
  });
});

describe("aplicarAlteracao", () => {
  it("grava o texto como foi digitado, sem mexer no original", () => {
    const original = { "1": "10" };
    const novo = aplicarAlteracao(original, "2", "20,5");
    expect(novo).toEqual({ "1": "10", "2": "20,5" });
    expect(original).toEqual({ "1": "10" });
  });

  it("sobrescreve a chave existente", () => {
    expect(aplicarAlteracao({ "1": "10" }, "1", "15")).toEqual({ "1": "15" });
  });

  it("null, vazio ou só espaços apagam a chave", () => {
    expect(aplicarAlteracao({ "1": "10", "2": "5" }, "1", null)).toEqual({ "2": "5" });
    expect(aplicarAlteracao({ "1": "10" }, "1", "")).toEqual({});
    expect(aplicarAlteracao({ "1": "10" }, "1", "   ")).toEqual({});
  });

  it("apagar chave que não existe não muda nada", () => {
    expect(aplicarAlteracao({ "1": "10" }, "9", null)).toEqual({ "1": "10" });
  });
});

describe("mesclarComPendentes", () => {
  it("sem pendentes, o servidor manda (o que os outros digitaram aparece)", () => {
    const local = { "1": "10" };
    const servidor = { "1": "10", "2": "30" };
    expect(mesclarComPendentes(local, servidor, new Set())).toEqual({ "1": "10", "2": "30" });
  });

  it("valor que o servidor não tem mais (outro usuário apagou) some da tela", () => {
    expect(mesclarComPendentes({ "1": "10" }, {}, new Set())).toEqual({});
  });

  it("chave pendente fica como está na tela, mesmo que o servidor tenha outro valor", () => {
    const local = { "1": "12" };
    const servidor = { "1": "10", "2": "30" };
    expect(mesclarComPendentes(local, servidor, new Set(["1"]))).toEqual({ "1": "12", "2": "30" });
  });

  it("chave pendente apagada na tela continua apagada, mesmo que o servidor ainda tenha o valor", () => {
    const local = {};
    const servidor = { "1": "10", "2": "30" };
    expect(mesclarComPendentes(local, servidor, new Set(["1"]))).toEqual({ "2": "30" });
  });

  it("chave pendente digitada aqui que o servidor ainda não tem é mantida", () => {
    expect(mesclarComPendentes({ "7": "5" }, {}, new Set(["7"]))).toEqual({ "7": "5" });
  });

  it("não altera os objetos recebidos", () => {
    const local = { "1": "12" };
    const servidor = { "1": "10" };
    mesclarComPendentes(local, servidor, new Set(["1"]));
    expect(local).toEqual({ "1": "12" });
    expect(servidor).toEqual({ "1": "10" });
  });
});

describe("valoresFaltandoNoServidor", () => {
  it("devolve só o que o servidor ainda não tem", () => {
    const antigos = { "1": "10", "2": "20", "3": "30" };
    const servidor = { "2": "25" };
    expect(valoresFaltandoNoServidor(antigos, servidor)).toEqual({ "1": "10", "3": "30" });
  });

  it("nunca sobrescreve um valor que o servidor já tem", () => {
    expect(valoresFaltandoNoServidor({ "1": "99" }, { "1": "10" })).toEqual({});
  });

  it("ignora valores vazios e lixo que não é texto", () => {
    const antigos = { "1": "", "2": "  ", "3": 5, "4": null, "5": "7" } as unknown as Record<string, string>;
    expect(valoresFaltandoNoServidor(antigos, {})).toEqual({ "5": "7" });
  });

  it("sem nada guardado no navegador, não há o que enviar", () => {
    expect(valoresFaltandoNoServidor({}, { "1": "10" })).toEqual({});
  });
});
