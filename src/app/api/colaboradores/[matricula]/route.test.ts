import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { getColaborador, upsertColaborador } from "@/lib/repo/colaboradores";
import { PUT } from "./route";

beforeEach(() => {
  resetDbForTests();
});

function putRequest(dados: Record<string, unknown>): Request {
  return new Request("http://localhost/api/colaboradores/1", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dados }),
  });
}

describe("PUT /api/colaboradores/[matricula]", () => {
  it("mescla com o cadastro existente em vez de apagar campos ausentes do corpo da requisição", async () => {
    upsertColaborador({
      matricula: 1,
      dados: { cod_epr: 1, nome: "FULANO DA SILVA", cpf: "111.111.111-11", endereco: "Rua A", salario: 1500 },
    });

    // Uma chamada de API que só manda nome + telefone (não o formulário completo) não pode apagar o resto.
    const res = await PUT(putRequest({ nome: "FULANO DA SILVA", telefone: "11999998888" }), {
      params: Promise.resolve({ matricula: "1" }),
    });
    expect(res.status).toBe(200);

    const colaborador = getColaborador(1)!;
    expect(colaborador.dados.telefone).toBe("11999998888");
    expect(colaborador.dados.cpf).toBe("111.111.111-11");
    expect(colaborador.dados.endereco).toBe("Rua A");
    expect(colaborador.salario).toBe(1500);
  });
});
