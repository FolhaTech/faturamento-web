import { describe, expect, it } from "vitest";
import { ccustoDoNomeDoArquivo, nomeBaseDoArquivo, resolverCcustoInformado } from "./ccustoDoNomeArquivo";

const ccustos = [
  { codigo: "21", nome: "CARBRINK" },
  { codigo: "19", nome: "IPEC" },
  { codigo: "10", nome: "ITAU R&S 1050" },
];

describe("nomeBaseDoArquivo", () => {
  it("tira extensão, competência e numeração de cópia", () => {
    expect(nomeBaseDoArquivo("CARBRINK 092026.xlsx")).toBe("CARBRINK");
    expect(nomeBaseDoArquivo("CARBRINK 092026 (1).xlsx")).toBe("CARBRINK");
    expect(nomeBaseDoArquivo("ipec_folha_092026.xls")).toBe("IPEC");
  });
});

describe("ccustoDoNomeDoArquivo", () => {
  it("casa quando o nome base é igual a um centro de custo cadastrado", () => {
    expect(ccustoDoNomeDoArquivo("CARBRINK 092026.xlsx", ccustos)).toEqual({ codigo: "21", nome: "CARBRINK" });
    expect(ccustoDoNomeDoArquivo("IPEC FOLHA 092026.xlsx", ccustos)).toEqual({ codigo: "19", nome: "IPEC" });
  });

  it("não chuta quando o nome só parece com algum centro de custo", () => {
    expect(ccustoDoNomeDoArquivo("ITAU RH1050 FABI - FOLHA 092026 1.xlsx", ccustos)).toBeNull();
    expect(ccustoDoNomeDoArquivo("Movimentos hospitau 1.xlsx", ccustos)).toBeNull();
  });

  it("ignora quando o mesmo nome aponta pra códigos diferentes (ambíguo)", () => {
    expect(ccustoDoNomeDoArquivo("ORIZON 092026.xlsx", [{ codigo: "18", nome: "ORIZON" }, { codigo: "ORIZON", nome: "ORIZON" }])).toBeNull();
  });
});

describe("resolverCcustoInformado", () => {
  it("usa o centro de custo cadastrado quando o nome já existe (sem acento/maiúscula)", () => {
    expect(resolverCcustoInformado("carbrink", ccustos)).toEqual({ codigo: "21", nome: "CARBRINK" });
    expect(resolverCcustoInformado("  Itau R&S 1050 ", ccustos)).toEqual({ codigo: "10", nome: "ITAU R&S 1050" });
  });

  it("cria um novo, com o nome em maiúsculas como código, quando não existe", () => {
    expect(resolverCcustoInformado("Chama Perecivel", ccustos)).toEqual({ codigo: "CHAMA PERECIVEL", nome: "CHAMA PERECIVEL" });
  });

  it("vazio não define centro de custo", () => {
    expect(resolverCcustoInformado("   ", ccustos)).toBeNull();
  });

  it("nome com códigos diferentes fica com o primeiro em ordem alfabética", () => {
    const ambiguos = [{ codigo: "ORIZON", nome: "ORIZON" }, { codigo: "18", nome: "ORIZON" }];
    expect(resolverCcustoInformado("orizon", ambiguos)).toEqual({ codigo: "18", nome: "ORIZON" });
  });
});
