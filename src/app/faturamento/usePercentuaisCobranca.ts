"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

/** Evento próprio: o "storage" do navegador só dispara em OUTRAS abas, não na que gravou. */
const EVENTO = "faturamento:percentuais-cobranca";

function assinar(onChange: () => void): () => void {
  window.addEventListener(EVENTO, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENTO, onChange);
    window.removeEventListener("storage", onChange);
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

/**
 * Percentual a cobrar de CADA colaborador (texto, como foi digitado) numa competência, lembrado neste
 * navegador. Um único item no localStorage por competência ({ matrícula: texto }) — o card de totais,
 * a tabela de colaboradores e o link "Exportar PDF" leem o mesmo estado.
 */
export function usePercentuaisCobranca(
  competencia: string,
): readonly [Record<string, string>, (matricula: number, novo: string) => void, (matriculas: number[]) => void] {
  const chave = `faturamento:percentuais-cobranca:${competencia}`;
  // No servidor (e na hidratação) nasce vazio; no navegador lê o que ficou lembrado.
  const json = useSyncExternalStore(assinar, () => lerArmazenado(chave), () => "");
  // Sem armazenamento (janela privada, bloqueado) os valores ficam só aqui, pros campos continuarem funcionando.
  const [semArmazenamento, setSemArmazenamento] = useState<{ chave: string; valores: Record<string, string> } | null>(null);

  const valores = useMemo(() => (semArmazenamento?.chave === chave ? semArmazenamento.valores : interpretar(json)), [json, chave, semArmazenamento]);

  function gravar(proximo: Record<string, string>) {
    try {
      if (Object.keys(proximo).length === 0) window.localStorage.removeItem(chave);
      else window.localStorage.setItem(chave, JSON.stringify(proximo));
      window.dispatchEvent(new Event(EVENTO));
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

  /** Apaga o percentual de vários colaboradores de uma vez (de uma só gravação — chamar alterar() em laço usaria o estado antigo a cada volta). */
  function limpar(matriculas: number[]) {
    const proximo = { ...valores };
    for (const m of matriculas) delete proximo[String(m)];
    gravar(proximo);
  }

  return [valores, alterar, limpar] as const;
}
