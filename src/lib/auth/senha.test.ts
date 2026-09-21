import { describe, expect, it } from "vitest";
import { hashSenha, verificaSenha } from "./senha";

describe("hashSenha / verificaSenha", () => {
  it("verifica a senha correta contra o hash gerado", () => {
    const { hash, salt } = hashSenha("uma-senha-boa-123");
    expect(verificaSenha("uma-senha-boa-123", hash, salt)).toBe(true);
  });

  it("rejeita senha errada", () => {
    const { hash, salt } = hashSenha("uma-senha-boa-123");
    expect(verificaSenha("senha-errada", hash, salt)).toBe(false);
  });

  it("gera salt (e portanto hash) diferente a cada chamada, mesmo pra mesma senha", () => {
    const a = hashSenha("mesma-senha");
    const b = hashSenha("mesma-senha");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    // mas os dois continuam validando a senha original com seu próprio salt
    expect(verificaSenha("mesma-senha", a.hash, a.salt)).toBe(true);
    expect(verificaSenha("mesma-senha", b.hash, b.salt)).toBe(true);
  });
});
