"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

function assinar(evento: string) {
  return (onChange: () => void): (() => void) => {
    window.addEventListener(evento, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(evento, onChange);
      window.removeEventListener("storage", onChange);
    };
  };
}

function lerArmazenado(chave: string): string {
  try {
    return window.localStorage.getItem(chave) ?? "";
  } catch {
    return "";
  }
}

function interpretar(json: string): Record<string, string> {
  try {
    const valor = JSON.parse(json);
    return valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Record<string, string>) : {};
  } catch {
    return {};
  }
}

type Setter = (matricula: number, novo: string) => void;
type Limpar = (matriculas: number[]) => void;

/**
 * Texto digitado em um campo POR colaborador numa competência (matrícula -> texto), lembrado neste
 * navegador. Um único item no localStorage por competência e por campo — o card de totais, a tabela de
 * colaboradores e os links de PDF leem o mesmo estado. `campo` separa os campos entre si
 * (percentual, adiantamento) sem um apagar o outro.
 */
function usePorColaborador(campo: string, competencia: string): readonly [Record<string, string>, Setter, Limpar] {
  const chave = `faturamento:${campo}:${competencia}`;
  const evento = `faturamento:${campo}`;
  // No servidor (e na hidratação) nasce vazio; no navegador lê o que ficou lembrado.
  const json = useSyncExternalStore(
    useMemo(() => assinar(evento), [evento]),
    () => lerArmazenado(chave),
    () => "",
  );
  // Sem armazenamento (janela privada, bloqueado) os valores ficam só aqui, pros campos continuarem funcionando.
  const [semArmazenamento, setSemArmazenamento] = useState<{ chave: string; valores: Record<string, string> } | null>(null);

  const valores = useMemo(() => (semArmazenamento?.chave === chave ? semArmazenamento.valores : interpretar(json)), [json, chave, semArmazenamento]);

  function gravar(proximo: Record<string, string>) {
    try {
      if (Object.keys(proximo).length === 0) window.localStorage.removeItem(chave);
      else window.localStorage.setItem(chave, JSON.stringify(proximo));
      window.dispatchEvent(new Event(evento));
    } catch {
      setSemArmazenamento({ chave, valores: proximo });
    }
  }

  function alterar(matricula: number, novo: string) {
    const proximo = { ...valores };
    if (novo.trim() === "") delete proximo[String(matricula)];
    else proximo[String(matricula)] = novo;
    gravar(proximo);
  }

  /** Apaga o campo de vários colaboradores de uma vez (de uma só gravação — chamar alterar() em laço usaria o estado antigo a cada volta). */
  function limpar(matriculas: number[]) {
    const proximo = { ...valores };
    for (const m of matriculas) delete proximo[String(m)];
    gravar(proximo);
  }

  return [valores, alterar, limpar] as const;
}

/** Percentual a deduzir da Nota Fiscal de cada colaborador (texto digitado). */
export function usePercentuaisCobranca(competencia: string) {
  return usePorColaborador("percentuais-cobranca", competencia);
}

/** Adiantamento, em reais, a deduzir do total de cada colaborador (texto digitado). */
export function useAdiantamentos(competencia: string) {
  return usePorColaborador("adiantamentos", competencia);
}
