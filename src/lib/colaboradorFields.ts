// Gerado a partir das colunas reais da aba "Colaboradores" de Movimentacao-construcao.xlsx.
// Cada seção vira um bloco no formulário de edição; "key" é a coluna correspondente no banco (JSON).
export type CampoTipo = "text" | "number" | "date";

export interface CampoColaborador {
  key: string;
  label: string;
  tipo: CampoTipo;
}

export interface SecaoColaborador {
  secao: string;
  campos: CampoColaborador[];
}

export const SECOES_COLABORADOR: SecaoColaborador[] = [
  {
    secao: "Identificação",
    campos: [
      { key: "cod_emp", label: "Cód Emp", tipo: "text" },
      { key: "cod_epr", label: "Cód Epr", tipo: "text" },
      { key: "nome", label: "Nome", tipo: "text" },
      { key: "cod_esocial", label: "Cód eSocial", tipo: "text" },
    ],
  },
  {
    secao: "Vínculo e cargo",
    campos: [
      { key: "admissao", label: "Admissão", tipo: "date" },
      { key: "fim_determinado", label: "Fim Determinado", tipo: "date" },
      { key: "fim_prorrogacao", label: "Fim Prorrogação", tipo: "date" },
      { key: "salario", label: "Salário", tipo: "number" },
      { key: "categoria", label: "Categoria", tipo: "text" },
      { key: "cod_cargo", label: "Cód Cargo", tipo: "text" },
      { key: "descricao_cargo", label: "Descrição cargo", tipo: "text" },
      { key: "cbo", label: "CBO", tipo: "text" },
      { key: "cod_funcao", label: "Cód Função", tipo: "text" },
      { key: "descricao_funcao", label: "Descrição Função", tipo: "text" },
      { key: "cod_ccusto", label: "Cód Ccusto", tipo: "text" },
      { key: "descricao_ccusto", label: "Descrição Ccusto", tipo: "text" },
      { key: "cod_servico", label: "Cód Serviço", tipo: "text" },
      { key: "descricao_servico", label: "Descrição Serviço", tipo: "text" },
      { key: "cod_dpto", label: "Cód Dpto", tipo: "text" },
      { key: "descricao_dpto", label: "Descrição Dpto", tipo: "text" },
      { key: "cod_sind", label: "Cód Sind", tipo: "text" },
      { key: "sindicato", label: "Sindicato", tipo: "text" },
    ],
  },
  {
    secao: "Documentos civis",
    campos: [
      { key: "cpf", label: "CPF", tipo: "text" },
      { key: "pis", label: "PIS", tipo: "text" },
      { key: "rg", label: "RG", tipo: "text" },
      { key: "uf_rg", label: "UF RG", tipo: "text" },
      { key: "orgao_rg", label: "Orgão RG", tipo: "text" },
      { key: "data_ex", label: "Data EX", tipo: "date" },
    ],
  },
  {
    secao: "Nascimento",
    campos: [
      { key: "data_nascimento", label: "Data nascimento", tipo: "date" },
      { key: "cidade_nascimento", label: "Cidade nascimento", tipo: "date" },
      { key: "uf_nasc", label: "UF Nasc.", tipo: "text" },
      { key: "pais_nascimento", label: "Pais nascimento", tipo: "date" },
    ],
  },
  {
    secao: "Endereço e contato",
    campos: [
      { key: "endereco", label: "Endereço", tipo: "text" },
      { key: "numero", label: "Numero", tipo: "text" },
      { key: "complemento", label: "Complemento", tipo: "text" },
      { key: "bairro", label: "Bairro", tipo: "text" },
      { key: "cep", label: "Cep", tipo: "text" },
      { key: "cidade", label: "Cidade", tipo: "text" },
      { key: "uf_end", label: "UF End", tipo: "text" },
      { key: "telefone", label: "Telefone", tipo: "text" },
      { key: "celular", label: "Celular", tipo: "text" },
      { key: "email", label: "Email", tipo: "text" },
    ],
  },
  {
    secao: "Documentos adicionais",
    campos: [
      { key: "ric", label: "RIC", tipo: "text" },
      { key: "orgao_ric", label: "Orgão RIC", tipo: "text" },
      { key: "local_ric", label: "Local RIC", tipo: "text" },
      { key: "data_exp_ric", label: "Data Exp Ric", tipo: "date" },
      { key: "validade_ric", label: "Validade Ric", tipo: "date" },
      { key: "passaporte", label: "Passaporte", tipo: "text" },
      { key: "uf_pass", label: "UF Pass.", tipo: "text" },
      { key: "emissao_pass", label: "Emissão Pass.", tipo: "text" },
      { key: "validade_pass", label: "Validade Pass", tipo: "date" },
      { key: "rne", label: "RNE", tipo: "text" },
      { key: "orgao_rne", label: "Orgão RNE", tipo: "text" },
      { key: "expedicao_rne", label: "Expedição RNE", tipo: "date" },
      { key: "cnh", label: "CNH", tipo: "text" },
      { key: "categoria2", label: "Categoria2", tipo: "text" },
      { key: "expedicao_cnh", label: "Expedição CNH", tipo: "date" },
      { key: "vencimento", label: "Vencimento", tipo: "date" },
      { key: "reservista", label: "Reservista", tipo: "text" },
      { key: "titulo", label: "Titulo", tipo: "text" },
      { key: "zona", label: "Zona", tipo: "text" },
      { key: "secao", label: "Seção", tipo: "text" },
      { key: "ctps", label: "CTPS", tipo: "text" },
      { key: "serie_ctps", label: "Serie CTPS", tipo: "text" },
      { key: "uf_ctps", label: "UF CTPS", tipo: "text" },
      { key: "expedicao_ctps", label: "Expedição CTPS", tipo: "date" },
    ],
  },
  {
    secao: "Filiação e perfil",
    campos: [
      { key: "nome_mae", label: "Nome Mãe", tipo: "text" },
      { key: "nome_pai", label: "Nome Pai", tipo: "text" },
      { key: "sexo", label: "Sexo", tipo: "text" },
      { key: "estado_civil", label: "Estado Civil", tipo: "text" },
      { key: "raca_cor", label: "Raça/Cor", tipo: "text" },
      { key: "jornada", label: "Jornada", tipo: "text" },
    ],
  },
  {
    secao: "Bancário",
    campos: [
      { key: "nome_banco", label: "Nome Banco", tipo: "text" },
      { key: "tipo_conta", label: "Tipo Conta", tipo: "text" },
      { key: "agencia", label: "Agencia", tipo: "text" },
      { key: "conta", label: "Conta", tipo: "text" },
      { key: "coluna3", label: "Coluna3", tipo: "text" },
      { key: "nome_social", label: "Nome Social", tipo: "text" },
    ],
  },
  {
    secao: "Situação contratual",
    campos: [
      { key: "grau_instrucao", label: "Grau instrução", tipo: "text" },
      { key: "situacao", label: "Situação", tipo: "text" },
      { key: "data_demissao", label: "Data Demissão", tipo: "date" },
      { key: "motivo_demissao", label: "Motivo Demissão", tipo: "date" },
      { key: "tipo_empregado", label: "Tipo Empregado", tipo: "text" },
    ],
  },
  {
    secao: "Pessoa com deficiência",
    campos: [
      { key: "possui_deficiencia", label: "Possui deficiência", tipo: "text" },
      { key: "deficiencia_fisica", label: "Deficiência física", tipo: "text" },
      { key: "deficiencia_visual", label: "Deficiência visual", tipo: "text" },
      { key: "deficiencia_auditiva", label: "Deficiência auditiva", tipo: "text" },
      { key: "deficiencia_intelectual", label: "Deficiência intelectual", tipo: "text" },
      { key: "deficiencia_mental", label: "Deficiência mental", tipo: "text" },
      { key: "outra_deficiencia", label: "Outra deficiência", tipo: "text" },
      { key: "reabilitado_a", label: "Reabilitado(a)", tipo: "text" },
      { key: "observacao_deficiencia", label: "Observação deficiência", tipo: "text" },
      { key: "cota_deficiente", label: "Cota deficiente", tipo: "text" },
    ],
  },
  {
    secao: "Conselho de classe",
    campos: [
      { key: "nome_conselho", label: "Nome Conselho", tipo: "text" },
      { key: "numero_conselho", label: "Numero Conselho", tipo: "text" },
      { key: "expedicao_conselho", label: "Expedição Conselho", tipo: "date" },
      { key: "validade_conselho", label: "Validade Conselho", tipo: "date" },
    ],
  },
  {
    secao: "Dependente 1",
    campos: [
      { key: "nome_dependente_1", label: "Nome Dependente 1", tipo: "text" },
      { key: "nascimento_dependente_1", label: "Nascimento Dependente 1", tipo: "date" },
      { key: "cpf_dependente_1", label: "CPF Dependente 1", tipo: "text" },
      { key: "parentesco_dependente_1", label: "Parentesco Dependente 1", tipo: "text" },
    ],
  },
  {
    secao: "Dependente 2",
    campos: [
      { key: "nome_dependente_2", label: "Nome Dependente 2", tipo: "text" },
      { key: "nascimento_dependente_2", label: "Nascimento Dependente 2", tipo: "date" },
      { key: "cpf_dependente_2", label: "CPF Dependente 2", tipo: "text" },
      { key: "parentesco_dependente_2", label: "Parentesco Dependente 2", tipo: "text" },
    ],
  },
  {
    secao: "Dependente 3",
    campos: [
      { key: "nome_dependente_3", label: "Nome Dependente 3", tipo: "text" },
      { key: "nascimento_dependente_3", label: "Nascimento Dependente 3", tipo: "date" },
      { key: "cpf_dependente_3", label: "CPF Dependente 3", tipo: "text" },
      { key: "parentesco_dependente_3", label: "Parentesco Dependente 3", tipo: "text" },
    ],
  },
  {
    secao: "Dependente 4",
    campos: [
      { key: "nome_dependente_4", label: "Nome Dependente 4", tipo: "text" },
      { key: "nascimento_dependente_4", label: "Nascimento Dependente 4", tipo: "date" },
      { key: "cpf_dependente_4", label: "CPF Dependente 4", tipo: "text" },
      { key: "parentesco_dependente_4", label: "Parentesco Dependente 4", tipo: "text" },
    ],
  },
  {
    secao: "Dependente 5",
    campos: [
      { key: "nome_dependente_5", label: "Nome Dependente 5", tipo: "text" },
      { key: "nascimento_dependente_5", label: "Nascimento Dependente 5", tipo: "date" },
      { key: "cpf_dependente_5", label: "CPF Dependente 5", tipo: "text" },
      { key: "parentesco_dependente_5", label: "Parentesco Dependente 5", tipo: "text" },
    ],
  },
  {
    secao: "Dependente 6",
    campos: [
      { key: "nome_dependente_6", label: "Nome Dependente 6", tipo: "text" },
      { key: "nascimento_dependente_6", label: "Nascimento Dependente 6", tipo: "date" },
      { key: "cpf_dependente_6", label: "CPF Dependente 6", tipo: "text" },
      { key: "parentesco_dependente_6", label: "Parentesco Dependente 6", tipo: "text" },
    ],
  },
  {
    secao: "Dependente 7",
    campos: [
      { key: "nome_dependente_7", label: "Nome Dependente 7", tipo: "text" },
      { key: "nascimento_dependente_7", label: "Nascimento Dependente 7", tipo: "date" },
      { key: "cpf_dependente_7", label: "CPF Dependente 7", tipo: "text" },
    ],
  },
];

export const CAMPOS_COLABORADOR: CampoColaborador[] = SECOES_COLABORADOR.flatMap((s) => s.campos);
