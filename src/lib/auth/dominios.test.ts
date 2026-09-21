import { describe, expect, it } from "vitest";
import { dominioPermitidoParaCadastro } from "./dominios";

describe("dominioPermitidoParaCadastro", () => {
  it.each(["tiago@genter.com.br", "fulana@arantesarimura.com.br", "tiago.izaias@folhatech.com.br", "x@FOLHATECH.COM.BR"])(
    "libera %s",
    (email) => {
      expect(dominioPermitidoParaCadastro(email)).toBe(true);
    },
  );

  it.each(["fulano@gmail.com", "fulano@outraempresa.com.br", "sememail", "fulano@"])("bloqueia %s", (email) => {
    expect(dominioPermitidoParaCadastro(email)).toBe(false);
  });
});
