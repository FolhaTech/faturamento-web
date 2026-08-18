import * as XLSX from "xlsx";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "./db";
import { importReferenceBase } from "./importXlsx";
import { getColaborador } from "./repo/colaboradores";
import { getEncargo } from "./repo/encargos";
import { listInformativas } from "./repo/informativas";
import { getTomador } from "./repo/tomadores";

beforeEach(async () => {
  await resetDbForTests();
});

function bufferFromSheets(sheets: Record<string, unknown[][]>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("importReferenceBase", () => {
  it("importa as 4 abas e grava nos repositórios", async () => {
    const buffer = bufferFromSheets({
      Tomadores: [
        ["CÓD", "TOMADOR", "FPAS", "MODALIDADE", "TAXA ADM"],
        [36, "GRUPO CHAMA DE DISTRIBUICAO LTDA", 655, "Temporario", 0.12],
      ],
      Encargos: [
        ["CÓD", "EVENTO", "tipo", "INSS 655", "INSS 515", "FGTS", "PROV FÉR", "PROV 13º"],
        [8781, "DIAS NORMAIS", "P", 0.255, 0.288, 0.08, 0.1111, 0.0833],
      ],
      Informativas: [
        ["CÓD", "EVENTO", "VALOR", "RECORRÊNCIA", "INÍCIO", "OBS"],
        [327, "SEGURO DE VIDA FORNECIDO*", 5.5, "VALOR FIXO MENSAL", null, "obs"],
      ],
      Colaboradores: [
        ["Cód Emp", "Cód Epr", "Nome", "Situação", "Salário", "Cód Serviço", "Descrição Serviço"],
        [4, 90103478, "RICARDO HAELITO DA SILVA ARAUJO", "Trabalhando", 2200, 36, "GRUPO CHAMA DE DISTRIBUICAO LTDA"],
      ],
    });

    const result = await importReferenceBase(buffer);
    expect(result).toMatchObject({ tomadores: 1, encargos: 1, informativas: 1, colaboradores: 1, avisos: [] });

    expect(await getTomador(36)).toMatchObject({ nome: "GRUPO CHAMA DE DISTRIBUICAO LTDA", fpas: 655, taxaAdm: 0.12 });
    expect(await getEncargo(8781)).toMatchObject({ evento: "DIAS NORMAIS", inss515: 0.288 });

    const informativas = await listInformativas();
    expect(informativas).toHaveLength(1);
    expect(informativas[0].valor).toBe(5.5);

    const colaborador = (await getColaborador(90103478))!;
    expect(colaborador.nome).toBe("RICARDO HAELITO DA SILVA ARAUJO");
    expect(colaborador.codServico).toBe(36);
    // "Cód Epr" é campo de texto no formulário (ver colaboradorFields.ts) — a matrícula
    // numérica usada como chave primária vem de Number(dados.cod_epr), não do tipo aqui.
    expect(String(colaborador.dados.cod_epr)).toBe("90103478");
  });

  it("reimportar o mesmo arquivo atualiza os registros em vez de duplicar", async () => {
    const buffer = bufferFromSheets({
      Tomadores: [
        ["CÓD", "TOMADOR", "FPAS", "TAXA ADM"],
        [36, "GRUPO CHAMA DE DISTRIBUICAO LTDA", 655, 0.12],
      ],
      Colaboradores: [
        ["Cód Epr", "Nome", "Salário"],
        [1, "FULANO", 1000],
      ],
    });

    await importReferenceBase(buffer);
    await importReferenceBase(buffer);

    expect(await getTomador(36)).not.toBeNull();
    expect(await getColaborador(1)).not.toBeNull();
  });

  it("avisa quando uma aba esperada não existe no arquivo", async () => {
    const buffer = bufferFromSheets({
      Tomadores: [
        ["CÓD", "TOMADOR", "FPAS", "TAXA ADM"],
        [36, "GRUPO CHAMA", 655, 0.12],
      ],
    });

    const result = await importReferenceBase(buffer);
    expect(result.avisos.some((a) => a.includes("Encargos"))).toBe(true);
    expect(result.avisos.some((a) => a.includes("Colaboradores"))).toBe(true);
  });
});
