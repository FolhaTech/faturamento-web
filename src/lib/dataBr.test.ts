import { describe, expect, it } from "vitest";
import { formatarDataBr } from "./dataBr";

describe("formatarDataBr", () => {
  it("converte AAAA-MM-DD em dd/mm/aaaa sem mexer no dia", () => {
    expect(formatarDataBr("2026-09-08")).toBe("08/09/2026");
    expect(formatarDataBr("2019-10-07T00:00:00.000Z")).toBe("07/10/2019");
  });
  it("vazio ou inválido vira null", () => {
    expect(formatarDataBr(null)).toBeNull();
    expect(formatarDataBr("")).toBeNull();
    expect(formatarDataBr("08/09/2026")).toBeNull();
  });
});
