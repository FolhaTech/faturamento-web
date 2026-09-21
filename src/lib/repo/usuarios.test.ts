import { beforeEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "../db";
import { criarSessao, criarUsuario, destruirSessao, getUsuarioPorSessao, usuarioExiste, verificarCredenciais } from "./usuarios";

beforeEach(async () => {
  await resetDbForTests();
});

describe("usuarios repo — cadastro e login", () => {
  it("usuarioExiste é false antes do cadastro e true depois", async () => {
    expect(await usuarioExiste("tiago@folhatech.com.br")).toBe(false);
    await criarUsuario("Tiago", "tiago@folhatech.com.br", "senha-boa-123");
    expect(await usuarioExiste("tiago@folhatech.com.br")).toBe(true);
  });

  it("normaliza e-mail pra minúsculo ao cadastrar e checar existência", async () => {
    await criarUsuario("Tiago", "Tiago@FolhaTech.com.br", "senha-boa-123");
    expect(await usuarioExiste("tiago@folhatech.com.br")).toBe(true);
  });

  it("verificarCredenciais retorna o usuário com a senha certa", async () => {
    await criarUsuario("Tiago", "tiago@folhatech.com.br", "senha-boa-123");
    const usuario = await verificarCredenciais("tiago@folhatech.com.br", "senha-boa-123");
    expect(usuario).toEqual({ email: "tiago@folhatech.com.br", nome: "Tiago" });
  });

  it("verificarCredenciais retorna null com senha errada", async () => {
    await criarUsuario("Tiago", "tiago@folhatech.com.br", "senha-boa-123");
    expect(await verificarCredenciais("tiago@folhatech.com.br", "senha-errada")).toBeNull();
  });

  it("verificarCredenciais retorna null pra e-mail não cadastrado", async () => {
    expect(await verificarCredenciais("naoexiste@folhatech.com.br", "qualquer")).toBeNull();
  });

  it("nunca grava a senha em texto puro — senha_hash não bate com a senha original", async () => {
    await criarUsuario("Tiago", "tiago@folhatech.com.br", "senha-boa-123");
    const { getDb } = await import("../db");
    const [row] = await getDb()<{ senha_hash: string }[]>`SELECT senha_hash FROM usuarios WHERE email = 'tiago@folhatech.com.br'`;
    expect(row.senha_hash).not.toBe("senha-boa-123");
  });
});

describe("usuarios repo — sessão", () => {
  it("criarSessao + getUsuarioPorSessao retorna o dono do token", async () => {
    await criarUsuario("Tiago", "tiago@folhatech.com.br", "senha-boa-123");
    const { token } = await criarSessao("tiago@folhatech.com.br");
    const usuario = await getUsuarioPorSessao(token);
    expect(usuario).toEqual({ email: "tiago@folhatech.com.br", nome: "Tiago" });
  });

  it("token inexistente retorna null", async () => {
    expect(await getUsuarioPorSessao("token-que-nao-existe")).toBeNull();
  });

  it("destruirSessao invalida o token (logout)", async () => {
    await criarUsuario("Tiago", "tiago@folhatech.com.br", "senha-boa-123");
    const { token } = await criarSessao("tiago@folhatech.com.br");
    await destruirSessao(token);
    expect(await getUsuarioPorSessao(token)).toBeNull();
  });

  it("sessão expirada não valida mais", async () => {
    await criarUsuario("Tiago", "tiago@folhatech.com.br", "senha-boa-123");
    const { token } = await criarSessao("tiago@folhatech.com.br");
    const { getDb } = await import("../db");
    await getDb()`UPDATE sessoes SET expira_em = now() - interval '1 minute' WHERE token = ${token}`;
    expect(await getUsuarioPorSessao(token)).toBeNull();
  });
});
