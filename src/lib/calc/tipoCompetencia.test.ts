import { describe, expect, it } from "vitest";
import { aplicarTipoNaCompetencia, trocarTipoCompetencia } from "./tipoCompetencia";

describe("aplicarTipoNaCompetencia", () => {
  it("adiciona o sufixo de Prévia/Folha", () => {
    expect(aplicarTipoNaCompetencia("09/2026", "previa")).toBe("09/2026 (Prévia)");
    expect(aplicarTipoNaCompetencia("09/2026", "folha")).toBe("09/2026 (Folha)");
  });

  it("competência vazia (linha com erro de leitura) fica sem sufixo", () => {
    expect(aplicarTipoNaCompetencia("", "previa")).toBe("");
    expect(aplicarTipoNaCompetencia("   ", "folha")).toBe("   ");
  });
});

describe("trocarTipoCompetencia", () => {
  it("troca Folha por Prévia da mesma competência", () => {
    expect(trocarTipoCompetencia("09/2026 (Folha)", "folha", "previa")).toBe("09/2026 (Prévia)");
  });

  it("troca Prévia por Folha da mesma competência", () => {
    expect(trocarTipoCompetencia("09/2026 (Prévia)", "previa", "folha")).toBe("09/2026 (Folha)");
  });

  it("retorna null quando a competência não tem o sufixo de origem esperado", () => {
    expect(trocarTipoCompetencia("09/2026", "folha", "previa")).toBeNull();
    expect(trocarTipoCompetencia("09/2026 (Prévia)", "folha", "previa")).toBeNull();
  });
});
