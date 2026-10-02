import { describe, expect, it } from "vitest";
import { calcularAcumuladoLiquido } from "./acumuladoLiquido";

const COMP = "09/2026 (Folha)";
const provisoes = [
  ...Array.from({ length: 8 }, () => ({ provFerias: 537.8, prov13: 403.19 })),
  { provFerias: 157.930496083333, prov13: 118.450833333333 },
];

describe("calcularAcumuladoLiquido", () => {
  it("soma todas as provisões quando não há descontos", () => {
    expect(calcularAcumuladoLiquido(provisoes, [], COMP)).toEqual({ ferias: 4460.33, terco: 3343.97 });
  });

  it("não conta o desconto da própria competência (marcar Sim duas vezes dá o mesmo valor)", () => {
    const descontos = [
      { competencia: COMP, tipo: "ferias" as const, valor: -4460.33 },
      { competencia: COMP, tipo: "terco" as const, valor: -3343.97 },
    ];
    expect(calcularAcumuladoLiquido(provisoes, descontos, COMP)).toEqual({ ferias: 4460.33, terco: 3343.97 });
  });

  it("não abate o desconto da Prévia/Folha par do mesmo mês (é o mesmo mês, não um desconto anterior)", () => {
    const descontos = [
      { competencia: "09/2026 (Prévia)", tipo: "ferias" as const, valor: -4460.33 },
      { competencia: "09/2026 (Prévia)", tipo: "terco" as const, valor: -3343.97 },
    ];
    expect(calcularAcumuladoLiquido(provisoes, descontos, COMP)).toEqual({ ferias: 4460.33, terco: 3343.97 });
    // E o inverso: marcar na Prévia ignora o desconto que já está na Folha.
    const naFolha = [{ competencia: COMP, tipo: "ferias" as const, valor: -4460.33 }];
    expect(calcularAcumuladoLiquido(provisoes, naFolha, "09/2026 (Prévia)").ferias).toBe(4460.33);
  });

  it("abate descontos já lançados em outras competências, separando férias de 13º", () => {
    const descontos = [
      { competencia: "08/2026", tipo: "ferias" as const, valor: -1000 },
      { competencia: "08/2026", tipo: "terco" as const, valor: -300 },
    ];
    expect(calcularAcumuladoLiquido(provisoes, descontos, COMP)).toEqual({ ferias: 3460.33, terco: 3043.97 });
  });
});
