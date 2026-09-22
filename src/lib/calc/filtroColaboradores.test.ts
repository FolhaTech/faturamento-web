import { describe, expect, it } from "vitest";
import type { CalculatedLine } from "./engine";
import { filtrarLinesPorColaborador, temFiltroAtivo } from "./filtroColaboradores";

function linha(overrides: Partial<CalculatedLine>): CalculatedLine {
  return {
    matricula: 1,
    nome: "FULANO",
    codigo: 8781,
    evento: "DIAS NORMAIS",
    competencia: "01/2026",
    tipo: "P",
    tomadorCodigo: 1,
    tomadorNome: "TOMADOR",
    fpas: 515,
    tomadorGrossUp: 0.1325,
    tomadorGrossUpOperacao: "+",
    ccustoCodigo: "1",
    ccustoNome: "GERAL",
    trilha: "encargos",
    dre: 100,
    inss: 0,
    fgts: 0,
    provFerias: 0,
    prov13: 0,
    encInss: 0,
    encFgts: 0,
    base: 100,
    taxaAdmValor: 0,
    fatura: 100,
    impostos: 0,
    nf: 100,
    ...overrides,
  };
}

describe("temFiltroAtivo", () => {
  it("considera o filtro de regime (fpas) como filtro ativo, igual aos demais", () => {
    expect(temFiltroAtivo({ fpas: 515 })).toBe(true);
    expect(temFiltroAtivo({})).toBe(false);
  });
});

describe("filtrarLinesPorColaborador — regime (fpas)", () => {
  it("filtra só as linhas do FPAS pedido — não precisa consultar Colaboradores pra isso, fpas já vem na linha calculada", async () => {
    const linhas = [linha({ matricula: 1, fpas: 515 }), linha({ matricula: 2, fpas: 655 })];
    const resultado = await filtrarLinesPorColaborador(linhas, { fpas: 655 });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].matricula).toBe(2);
  });

  it("sem nenhum filtro ativo retorna todas as linhas sem alterar", async () => {
    const linhas = [linha({ matricula: 1, fpas: 515 }), linha({ matricula: 2, fpas: 655 })];
    const resultado = await filtrarLinesPorColaborador(linhas, {});
    expect(resultado).toHaveLength(2);
  });
});

describe("filtrarLinesPorColaborador — busca por colaborador (nome ou matrícula)", () => {
  it("filtra por nome, sem diferenciar maiúsculas/acento — não precisa consultar Colaboradores, nome já vem na linha calculada", async () => {
    const linhas = [linha({ matricula: 1, nome: "José da Silva" }), linha({ matricula: 2, nome: "Maria Souza" })];
    const resultado = await filtrarLinesPorColaborador(linhas, { colaborador: "jose" });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].matricula).toBe(1);
  });

  it("filtra por parte do nome (substring), não só o nome inteiro", async () => {
    const linhas = [linha({ matricula: 1, nome: "CARLOS EDUARDO DE ASSIS" }), linha({ matricula: 2, nome: "MARIA SOUZA" })];
    const resultado = await filtrarLinesPorColaborador(linhas, { colaborador: "eduardo" });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].matricula).toBe(1);
  });

  it("filtra por matrícula (substring) quando o nome não bate", async () => {
    const linhas = [linha({ matricula: 90103362, nome: "ALISON FERNANDES" }), linha({ matricula: 90103398, nome: "CARLOS EDUARDO" })];
    const resultado = await filtrarLinesPorColaborador(linhas, { colaborador: "90103362" });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].matricula).toBe(90103362);
  });

  it("combina com o filtro de regime — mesmo colaborador em dois regimes, só bate o filtrado", async () => {
    const linhas = [linha({ matricula: 1, nome: "FULANO", fpas: 515 }), linha({ matricula: 1, nome: "FULANO", fpas: 655 })];
    const resultado = await filtrarLinesPorColaborador(linhas, { colaborador: "fulano", fpas: 655 });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].fpas).toBe(655);
  });

  it("string em branco não conta como filtro ativo", () => {
    expect(temFiltroAtivo({ colaborador: "" })).toBe(false);
    expect(temFiltroAtivo({ colaborador: "  " })).toBe(false);
  });
});
