import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tomadores (
  codigo INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  fpas INTEGER NOT NULL DEFAULT 655,
  taxa_adm REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS encargos (
  codigo INTEGER PRIMARY KEY,
  evento TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'P',
  inss_655 REAL NOT NULL DEFAULT 0,
  inss_515 REAL NOT NULL DEFAULT 0,
  fgts REAL NOT NULL DEFAULT 0,
  prov_ferias REAL NOT NULL DEFAULT 0,
  prov_13 REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS informativas (
  id TEXT PRIMARY KEY,
  codigo INTEGER,
  evento TEXT NOT NULL,
  valor REAL NOT NULL DEFAULT 0,
  recorrencia TEXT,
  inicio TEXT,
  obs TEXT
);

CREATE TABLE IF NOT EXISTS colaboradores (
  matricula INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  situacao TEXT,
  cod_servico INTEGER,
  descricao_servico TEXT,
  salario REAL NOT NULL DEFAULT 0,
  admissao TEXT,
  data_demissao TEXT,
  dados TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_colaboradores_nome ON colaboradores(nome);
CREATE INDEX IF NOT EXISTS idx_colaboradores_situacao ON colaboradores(situacao);
CREATE INDEX IF NOT EXISTS idx_colaboradores_cod_servico ON colaboradores(cod_servico);

CREATE TABLE IF NOT EXISTS movimentos (
  id TEXT PRIMARY KEY,
  codigo INTEGER NOT NULL,
  matricula INTEGER NOT NULL,
  nome TEXT NOT NULL,
  evento TEXT NOT NULL,
  competencia TEXT NOT NULL,
  valor REAL NOT NULL DEFAULT 0,
  ref REAL NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'P',
  forma TEXT
);
CREATE INDEX IF NOT EXISTS idx_movimentos_competencia ON movimentos(competencia);
CREATE INDEX IF NOT EXISTS idx_movimentos_matricula ON movimentos(matricula);
`;

declare global {
  var __db__: DatabaseSync | undefined;
}

function createConnection(): DatabaseSync {
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  return db;
}

/** Conexão única (evita reabrir o arquivo a cada hot-reload do Next.js em dev). */
export function getDb(): DatabaseSync {
  if (!globalThis.__db__) {
    globalThis.__db__ = createConnection();
  }
  return globalThis.__db__;
}

/** Uso exclusivo em testes: troca a conexão ativa por um banco novo em memória. */
export function resetDbForTests(): DatabaseSync {
  globalThis.__db__?.close();
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);
  globalThis.__db__ = db;
  return db;
}
