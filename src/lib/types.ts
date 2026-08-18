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
}
