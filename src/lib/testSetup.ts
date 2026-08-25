/**
 * Roda antes de qualquer teste (ver vitest.config.ts). Garante que a suíte nunca
 * aponte para o banco de produção: os testes chamam resetDbForTests(), que dá
 * TRUNCATE nas tabelas — já aconteceu de isso apagar dados reais porque não havia
 * um banco de teste separado. Aqui exigimos TEST_DATABASE_URL e sobrescrevemos
 * DATABASE_URL só dentro do processo de teste, para que o resto do código (que só
 * conhece DATABASE_URL) use o banco de teste sem precisar saber disso.
 */
if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL não configurada. Os testes rodam TRUNCATE nas tabelas — " +
      "configure um banco Postgres separado do de produção em TEST_DATABASE_URL (.env.local) antes de rodar a suíte. Veja .env.example.",
  );
}
if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL não pode ser igual a DATABASE_URL — isso apagaria os dados de produção outra vez.");
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
