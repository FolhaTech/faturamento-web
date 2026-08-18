import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "../db";
import { getColaborador, listColaboradores, upsertColaborador } from "./colaboradores";

beforeEach(async () => {
  await resetDbForTests();
});

describe("colaboradores repo", () => {
  it("grava e recupera todos os campos passados em dados, e deriva as colunas indexadas", async () => {
    await upsertColaborador({
      matricula: 90103478,
      dados: {
        cod_epr: 90103478,
        nome: "RICARDO HAELITO DA SILVA ARAUJO",
        situacao: "Trabalhando",
        cod_servico: 36,
        descricao_servico: "GRUPO CHAMA DE DISTRIBUICAO LTDA",
        salario: 2200,
        admissao: "2026-07-15",
        cpf: "111.111.111-11",
      },
    });

    const c = (await getColaborador(90103478))!;
    expect(c.nome).toBe("RICARDO HAELITO DA SILVA ARAUJO");
    expect(c.situacao).toBe("Trabalhando");
    expect(c.codServico).toBe(36);
    expect(c.salario).toBe(2200);
    expect(c.dados.cpf).toBe("111.111.111-11");
  });

  it("upsert por matrícula atualiza o registro existente em vez de duplicar", async () => {
    await upsertColaborador({ matricula: 1, dados: { cod_epr: 1, nome: "FULANO", salario: 1000 } });
    await upsertColaborador({ matricula: 1, dados: { cod_epr: 1, nome: "FULANO DA SILVA", salario: 1500 } });

    const { items, total } = await listColaboradores();
    expect(total).toBe(1);
    expect(items[0].nome).toBe("FULANO DA SILVA");
    expect(items[0].salario).toBe(1500);
  });

  it("busca por nome (ILIKE, case-insensitive) e por matrícula", async () => {
    await upsertColaborador({ matricula: 90103478, dados: { cod_epr: 90103478, nome: "RICARDO HAELITO" } });
    await upsertColaborador({ matricula: 90103482, dados: { cod_epr: 90103482, nome: "ALEXANDRE GONCALVES" } });

    expect((await listColaboradores({ busca: "ricardo" })).total).toBe(1);
    expect((await listColaboradores({ busca: "90103482" })).total).toBe(1);
    expect((await listColaboradores({ busca: "inexistente" })).total).toBe(0);
  });

  it("pagina os resultados respeitando page/pageSize", async () => {
    for (let i = 1; i <= 5; i++) {
      await upsertColaborador({ matricula: i, dados: { cod_epr: i, nome: `COLABORADOR ${i}` } });
    }
    const page1 = await listColaboradores({ page: 1, pageSize: 2 });
    const page2 = await listColaboradores({ page: 2, pageSize: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page1.items.map((c) => c.matricula)).not.toEqual(page2.items.map((c) => c.matricula));
  });
});
