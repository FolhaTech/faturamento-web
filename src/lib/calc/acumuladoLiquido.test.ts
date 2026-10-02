import { describe, expect, it } from "vitest";
import { calcularAcumuladoLiquido } from "./acumuladoLiquido";

const COMP = "09/2026 (Folha)";

/** CECILIA: provisão salva só em 09/2026; 06 a 08/2026 estão como desconto (633,23 férias · 474,73 13º por mês). */
const provisoesCecilia = [{ provFerias: 282.527381083333, prov13: 211.900833333333 }];
const descontosCecilia = ["06/2026", "07/2026", "08/2026"].flatMap((competencia) => [
  { competencia, tipo: "ferias" as const, valor: -633.23 },
  { competencia, tipo: "terco" as const, valor: -474.73 },
]);

describe("calcularAcumuladoLiquido", () => {
  it("o desconto a lançar é o Subtotal desconto, sem abater o Subtotal provisão", () => {
    const r = calcularAcumuladoLiquido(provisoesCecilia, descontosCecilia, COMP);
    expect(r.ferias).toEqual({ provisao: 282.53, desconto: 1899.69, aLancar: 1899.69 });
    expect(r.terco).toEqual({ provisao: 211.9, desconto: 1424.19, aLancar: 1424.19 });
  });

  it("sem nenhum desconto lançado, usa o Subtotal provisão", () => {
    const provisoes = [{ provFerias: 4460.33, prov13: 3343.97 }];
    const r = calcularAcumuladoLiquido(provisoes, [], COMP);
    expect(r.ferias.aLancar).toBe(4460.33);
    expect(r.terco.aLancar).toBe(3343.97);
  });

  it("não conta o desconto da própria competência (marcar Sim duas vezes dá o mesmo valor)", () => {
    const descontos = [...descontosCecilia, { competencia: COMP, tipo: "ferias" as const, valor: -1899.69 }];
    expect(calcularAcumuladoLiquido(provisoesCecilia, descontos, COMP).ferias.aLancar).toBe(1899.69);
  });

  it("não conta o desconto da Prévia/Folha par do mesmo mês (é o mesmo mês, não um desconto anterior)", () => {
    const naPrevia = [{ competencia: "09/2026 (Prévia)", tipo: "ferias" as const, valor: -2387.95 }];
    const provisoes = [{ provFerias: 2387.95, prov13: 0 }];
    expect(calcularAcumuladoLiquido(provisoes, naPrevia, COMP).ferias).toEqual({ provisao: 2387.95, desconto: 0, aLancar: 2387.95 });
    // E o inverso: marcar na Prévia ignora o desconto que já está na Folha.
    const naFolha = [{ competencia: COMP, tipo: "ferias" as const, valor: -2387.95 }];
    expect(calcularAcumuladoLiquido(provisoes, naFolha, "09/2026 (Prévia)").ferias.aLancar).toBe(2387.95);
  });

  it("separa férias de 13º", () => {
    const descontos = [{ competencia: "08/2026", tipo: "ferias" as const, valor: -1000 }];
    const r = calcularAcumuladoLiquido([{ provFerias: 500, prov13: 300 }], descontos, COMP);
    expect(r.ferias.aLancar).toBe(1000);
    expect(r.terco.aLancar).toBe(300);
  });
});
