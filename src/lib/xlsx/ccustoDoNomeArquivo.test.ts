import { describe, expect, it } from "vitest";
import { ccustoDoNomeDoArquivo, nomeBaseDoArquivo, numeroDoCcustoNoNome, resolverCcustoInformado, sugestaoDeCcusto } from "./ccustoDoNomeArquivo";

const ccustos = [
  { codigo: "21", nome: "CARBRINK" },
  { codigo: "19", nome: "IPEC" },
  { codigo: "10", nome: "ITAU R&S 1050" },
];

// Centros de custo reais da XP: o nome do arquivo ("Movimentos cc1120.xlsx", "Movimentos cc1130.xls") só se distingue pelo número.
const ccustosXp = [
  { codigo: "16", nome: "XP 1120" },
  { codigo: "15", nome: "XP 1130" },
];

describe("numeroDoCcustoNoNome", () => {
  it("lê o número depois de CC, colado ou separado", () => {
    expect(numeroDoCcustoNoNome("Movimentos cc1120.xlsx")).toBe("1120");
    expect(numeroDoCcustoNoNome("Movimentos cc1130.xls")).toBe("1130");
    expect(numeroDoCcustoNoNome("Movimentos CC 1130 (1).xlsx")).toBe("1130");
    expect(numeroDoCcustoNoNome("movimentos_cc_1130.xlsx")).toBe("1130");
    expect(numeroDoCcustoNoNome("Movimentos cc-1130.xlsx")).toBe("1130");
    expect(numeroDoCcustoNoNome("cc01130 folha.xlsx")).toBe("1130");
  });

  it("sem o marcador CC não há número de centro de custo (competência e códigos soltos não valem)", () => {
    expect(numeroDoCcustoNoNome("CARBRINK 092026.xlsx")).toBeNull();
    expect(numeroDoCcustoNoNome("ITAU RH1050 FABI - FOLHA 092026 1.xlsx")).toBeNull();
    expect(numeroDoCcustoNoNome("Movimentos hospitau 1.xlsx")).toBeNull();
    expect(numeroDoCcustoNoNome("Movimentos acc1130.xlsx")).toBeNull(); // "acc" não é "cc"
    expect(numeroDoCcustoNoNome("Movimentos cc.xlsx")).toBeNull();
    expect(numeroDoCcustoNoNome("Movimentos cc1130x.xlsx")).toBeNull();
  });
});

describe("nomeBaseDoArquivo", () => {
  it("tira extensão, competência e numeração de cópia", () => {
    expect(nomeBaseDoArquivo("CARBRINK 092026.xlsx")).toBe("CARBRINK");
    expect(nomeBaseDoArquivo("CARBRINK 092026 (1).xlsx")).toBe("CARBRINK");
    expect(nomeBaseDoArquivo("ipec_folha_092026.xls")).toBe("IPEC");
  });

  it("tira também a extensão dupla (arquivo salvo como nome.xls.xlsx)", () => {
    expect(nomeBaseDoArquivo("Movimentos xp 1140.xls.xlsx")).toBe("MOVIMENTOS XP");
    expect(nomeBaseDoArquivo("CARBRINK 092026.xls.xlsx")).toBe("CARBRINK");
  });
});

describe("sugestaoDeCcusto", () => {
  it("sugere o centro de custo cadastrado que o nome do arquivo indica", () => {
    expect(sugestaoDeCcusto("Movimentos cc1130.xls", ccustosXp)).toBe("XP 1130");
    expect(sugestaoDeCcusto("CARBRINK 092026.xlsx", ccustos)).toBe("CARBRINK");
  });

  it("sem cadastrado, sugere o nome do arquivo mantendo os números que não são a competência", () => {
    expect(sugestaoDeCcusto("Movimentos xp 1140.xls.xlsx", ccustosXp)).toBe("XP 1140");
    expect(sugestaoDeCcusto("Movimentos XP 1140 092026 (1).xlsx", ccustosXp)).toBe("XP 1140");
    expect(sugestaoDeCcusto("movimentos_folha_chama_perecivel_092026.xlsx", ccustos)).toBe("CHAMA PERECIVEL");
    expect(sugestaoDeCcusto("ITAU RH1050 FABI - FOLHA 092026 1.xlsx", ccustos)).toBe("ITAU RH1050 FABI");
  });

  it("não sugere quando só sobram números ou nada", () => {
    expect(sugestaoDeCcusto("Movimentos cc9999.xlsx", ccustosXp)).toBe("");
    expect(sugestaoDeCcusto("Movimentos 092026.xlsx", ccustosXp)).toBe("");
    expect(sugestaoDeCcusto("Folha.xlsx", ccustosXp)).toBe("");
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

  it('"Movimentos cc1120" e "Movimentos cc1130" vão cada um pro seu centro de custo (antes caíam no mesmo, pelo cadastro do colaborador)', () => {
    expect(ccustoDoNomeDoArquivo("Movimentos cc1120.xlsx", ccustosXp)).toEqual({ codigo: "16", nome: "XP 1120" });
    expect(ccustoDoNomeDoArquivo("Movimentos cc1130.xls", ccustosXp)).toEqual({ codigo: "15", nome: "XP 1130" });
    expect(ccustoDoNomeDoArquivo("Movimentos CC 1130 (1).xlsx", ccustosXp)).toEqual({ codigo: "15", nome: "XP 1130" });
  });

  it("número que nenhum centro de custo tem no nome, ou que mais de um tem, não chuta", () => {
    expect(ccustoDoNomeDoArquivo("Movimentos cc9999.xlsx", ccustosXp)).toBeNull();
    const repetido = [...ccustosXp, { codigo: "30", nome: "ITAU 1130" }];
    expect(ccustoDoNomeDoArquivo("Movimentos cc1130.xls", repetido)).toBeNull();
    // o mesmo centro de custo cadastrado com o mesmo código não é ambíguo
    expect(ccustoDoNomeDoArquivo("Movimentos cc1130.xls", [...ccustosXp, { codigo: "15", nome: "XP 1130 (SP)" }])).toEqual({ codigo: "15", nome: "XP 1130" });
  });

  it("sem o marcador CC o número solto continua não valendo (ITAU RH1050 não vira ITAU R&S 1050)", () => {
    expect(ccustoDoNomeDoArquivo("ITAU RH1050 FABI - FOLHA 092026 1.xlsx", ccustos)).toBeNull();
    expect(ccustoDoNomeDoArquivo("Movimentos 1130.xlsx", ccustosXp)).toBeNull();
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
