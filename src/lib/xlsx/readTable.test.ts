import { describe, expect, it } from "vitest";
import { asNumber } from "./readTable";
describe("asNumber — salários exportados", () => {
 it("preserva casas decimais com ponto e aceita formato brasileiro", () => {
  expect(asNumber("2232.530000")).toBe(2232.53);
  expect(asNumber("9235.660000")).toBe(9235.66);
  expect(asNumber("2.232,53")).toBe(2232.53);
  expect(asNumber("2232,53")).toBe(2232.53);
  expect(asNumber(2232.53)).toBe(2232.53);
 });
});
