"use client";

import { useState, useSyncExternalStore } from "react";

/** Evento próprio: o "storage" do navegador só dispara em OUTRAS abas, não na que gravou. */
const EVENTO = "faturamento:percentual-cobranca";

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

/**
 * Percentual a cobrar digitado no Faturamento (texto, como foi digitado), lembrado neste navegador por
 * competência + centro de custo. Fica num hook à parte porque dois lugares precisam dele: o campo no
 * card de totais e o link "Exportar PDF", que leva o percentual pra sair no relatório.
 */
export function usePercentualCobranca(competencia: string, ccustoCodigo: string): readonly [string, (novo: string) => void] {
  const chave = `faturamento:percentual-cobranca:${competencia}:${ccustoCodigo}`;
  // No servidor (e na hidratação) o campo nasce vazio; no navegador lê o valor lembrado.
  const texto = useSyncExternalStore(assinar, () => lerArmazenado(chave), () => "");
  // Sem armazenamento (janela privada, bloqueado) o valor digitado fica só aqui, pro campo continuar funcionando.
  const [semArmazenamento, setSemArmazenamento] = useState<{ chave: string; valor: string } | null>(null);

  function alterar(novo: string) {
    try {
      if (novo.trim() === "") window.localStorage.removeItem(chave);
      else window.localStorage.setItem(chave, novo);
      window.dispatchEvent(new Event(EVENTO));
    } catch {
      setSemArmazenamento({ chave, valor: novo });
    }
  }

  return [semArmazenamento?.chave === chave ? semArmazenamento.valor : texto, alterar] as const;
}
