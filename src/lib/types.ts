export type TipoEvento = "P" | "D" | "I" | "R" | "FGTS" | "INSS";

export interface Tomador {
  codigo: number;
  nome: string;
  fpas: 515 | 655;
  taxaAdm: number;
}

export interface Encargo {
  codigo: number;
  evento: string;
  tipo: TipoEvento;
  inss655: number;
  inss515: number;
  fgts: number;
  provFerias: number;
  prov13: number;
  /** Marca este código como o pagamento real de férias/1/3 (não a provisão mensal) — abate o saldo de férias do colaborador em vez de cobrar o valor cheio. */
  abateSaldoFerias: boolean;
}

export interface Informativa {
  id: string;
  codigo: number | null;
  evento: string;
  valor: number;
  recorrencia: string | null;
  inicio: string | null;
  obs: string | null;
}

export interface Movimento {
  id: string;
  codigo: number;
  matricula: number;
  nome: string;
  evento: string;
  competencia: string;
  valor: number;
  ref: number;
  tipo: TipoEvento;
  forma: string | null;
  /** Quanto desse lançamento foi abatido do saldo de férias/1/3 do colaborador — congelado no upload (ver abatimentoFerias.ts). Opcional: ausente = 0. */
  abatimentoFerias?: number;
}

/** Valor de cada campo do formulário de Colaborador (ver colaboradorFields.ts). */
export type DadosColaborador = Record<string, string | number | null>;

export interface Colaborador {
  matricula: number;
  nome: string;
  situacao: string | null;
  codServico: number | null;
  descricaoServico: string | null;
  salario: number;
  admissao: string | null;
  dataDemissao: string | null;
  dados: DadosColaborador;
  /** Saldo de férias e 1/3 já provisionado/cobrado do tomador, editado manualmente — ver saldo_ferias em db.ts. */
  saldoFerias: number;
}
