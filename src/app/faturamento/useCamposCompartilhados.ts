"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  aplicarAlteracao,
  CAMPOS,
  camposVazios,
  mesclarComPendentes,
  valoresFaltandoNoServidor,
  type Campo,
  type CamposCompartilhados,
  type Valores,
} from "@/lib/camposCompartilhados";

/** Quanto esperar depois da última tecla antes de gravar — evita uma gravação por letra digitada. */
const ATRASO_SALVAR_MS = 500;
/** Reenvio quando a gravação falha (sem rede, servidor ocupado) — o valor digitado continua na tela até dar certo. */
const ATRASO_RETENTAR_MS = 5000;
/** De quanto em quanto tempo buscar o que os outros usuários digitaram (além de buscar ao voltar pra aba). */
const INTERVALO_ATUALIZAR_MS = 20000;

/** Nome do item de localStorage de antes de os valores serem compartilhados (um por competência e campo) — ver recuperarValoresAntigos. */
const CHAVE_ANTIGA: Record<Campo, string> = { percentual: "percentuais-cobranca", adiantamento: "adiantamentos", base: "bases-retencoes" };

export type EstadoSalvamento = "ok" | "salvando" | "erro";

interface Pendente {
  campo: Campo;
  chave: string;
  /** null = apagar. */
  valor: string | null;
  timer: ReturnType<typeof setTimeout> | null;
}

async function enviar(competencia: string, campo: Campo, alteracoes: Record<string, string | null>): Promise<boolean> {
  try {
    const res = await fetch("/api/faturamento/campos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competencia, campo, alteracoes }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function buscar(competencia: string): Promise<CamposCompartilhados | null> {
  try {
    const res = await fetch(`/api/faturamento/campos?competencia=${encodeURIComponent(competencia)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const dados = (await res.json()) as Partial<CamposCompartilhados>;
    return { percentual: dados.percentual ?? {}, adiantamento: dados.adiantamento ?? {}, base: dados.base ?? {} };
  } catch {
    return null;
  }
}

function lerAntigo(competencia: string, campo: Campo): Valores {
  try {
    const bruto = window.localStorage.getItem(`faturamento:${CHAVE_ANTIGA[campo]}:${competencia}`);
    const json = bruto ? JSON.parse(bruto) : null;
    return json && typeof json === "object" && !Array.isArray(json) ? (json as Valores) : {};
  } catch {
    return {};
  }
}

function removerAntigo(competencia: string, campo: Campo) {
  try {
    window.localStorage.removeItem(`faturamento:${CHAVE_ANTIGA[campo]}:${competencia}`);
  } catch {
    // sem acesso ao armazenamento: nada a limpar
  }
}

/**
 * Valores digitados na tela de Faturamento — % a deduzir e adiantamento por colaborador, base das retenções por centro de custo —
 * COMPARTILHADOS entre todos os usuários (tabela faturamento_campos). O que um digita aparece pra todos:
 * - começa com o que o servidor já tinha (`iniciais`);
 * - ao digitar, a tela muda na hora e o valor é gravado logo depois da última tecla;
 * - a cada 20 s e ao voltar pra aba, busca o que os outros digitaram, sem mexer no que está sendo digitado aqui;
 * - valores que ficaram só neste navegador (de antes do compartilhamento) são enviados uma única vez, sem sobrescrever o que o
 *   servidor já tem, e o aviso `migrados` diz quantos.
 */
export function useCamposCompartilhados(competencia: string, iniciais: CamposCompartilhados) {
  const [valores, setValores] = useState<CamposCompartilhados>(iniciais);
  const [estado, setEstado] = useState<EstadoSalvamento>("ok");
  const [migrados, setMigrados] = useState(0);
  const pendentes = useRef(new Map<string, Pendente>());
  const iniciaisRef = useRef(iniciais);

  // A função de envio fica numa ref pra poder se chamar de novo (reenvio quando falha) sem referenciar a si mesma ao ser declarada.
  const enviarLoteRef = useRef<(itens: Pendente[]) => Promise<void>>(async () => {});
  const enviarLote = useCallback((itens: Pendente[]) => enviarLoteRef.current(itens), []);
  useEffect(() => {
    enviarLoteRef.current = async (itens: Pendente[]) => {
      if (competencia === "" || itens.length === 0) return;
      setEstado("salvando");
      const porCampo = new Map<Campo, Record<string, string | null>>();
      for (const i of itens) porCampo.set(i.campo, { ...(porCampo.get(i.campo) ?? {}), [i.chave]: i.valor });

      let ok = true;
      for (const [campo, alteracoes] of porCampo) ok = (await enviar(competencia, campo, alteracoes)) && ok;

      for (const i of itens) {
        const k = `${i.campo}|${i.chave}`;
        if (pendentes.current.get(k) !== i) continue; // digitou de novo enquanto enviava: o item novo cuida de si
        if (ok) pendentes.current.delete(k);
        else i.timer = setTimeout(() => void enviarLoteRef.current([i]), ATRASO_RETENTAR_MS);
      }
      setEstado(ok ? (pendentes.current.size > 0 ? "salvando" : "ok") : "erro");
    };
  }, [competencia]);

  const alterar = useCallback(
    (campo: Campo, chave: string, novo: string) => {
      setValores((v) => ({ ...v, [campo]: aplicarAlteracao(v[campo], chave, novo) }));
      const k = `${campo}|${chave}`;
      const anterior = pendentes.current.get(k);
      if (anterior?.timer) clearTimeout(anterior.timer);
      const item: Pendente = { campo, chave, valor: novo.trim() === "" ? null : novo, timer: null };
      item.timer = setTimeout(() => void enviarLote([item]), ATRASO_SALVAR_MS);
      pendentes.current.set(k, item);
    },
    [enviarLote],
  );

  /** Apaga o campo de várias chaves de uma vez (uma gravação só). */
  const limpar = useCallback(
    (campo: Campo, chaves: string[]) => {
      if (chaves.length === 0) return;
      setValores((v) => ({ ...v, [campo]: chaves.reduce((acc, chave) => aplicarAlteracao(acc, chave, null), v[campo]) }));
      const itens = chaves.map((chave): Pendente => {
        const anterior = pendentes.current.get(`${campo}|${chave}`);
        if (anterior?.timer) clearTimeout(anterior.timer);
        const item: Pendente = { campo, chave, valor: null, timer: null };
        pendentes.current.set(`${campo}|${chave}`, item);
        return item;
      });
      void enviarLote(itens);
    },
    [enviarLote],
  );

  const atualizar = useCallback(async () => {
    if (competencia === "") return;
    const servidor = await buscar(competencia);
    if (!servidor) return;
    const pendentesPorCampo: Record<Campo, Set<string>> = { percentual: new Set(), adiantamento: new Set(), base: new Set() };
    for (const p of pendentes.current.values()) pendentesPorCampo[p.campo].add(p.chave);
    setValores((local) => {
      const novo = camposVazios();
      for (const campo of CAMPOS) novo[campo] = mesclarComPendentes(local[campo], servidor[campo], pendentesPorCampo[campo]);
      return novo;
    });
  }, [competencia]);

  // Atualização periódica e ao voltar pra aba: o que outro usuário digitou aparece sem recarregar a página.
  useEffect(() => {
    if (competencia === "") return;
    const id = setInterval(() => void atualizar(), INTERVALO_ATUALIZAR_MS);
    const aoVoltar = () => void atualizar();
    window.addEventListener("focus", aoVoltar);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [competencia, atualizar]);

  // Recupera, uma única vez, os valores que ficaram só neste navegador (de antes de serem compartilhados).
  useEffect(() => {
    if (competencia === "") return;
    let ativo = true;
    (async () => {
      const antigos = Object.fromEntries(CAMPOS.map((c) => [c, lerAntigo(competencia, c)])) as Record<Campo, Valores>;
      if (CAMPOS.every((c) => Object.keys(antigos[c]).length === 0)) return;

      const servidor = (await buscar(competencia)) ?? iniciaisRef.current;
      let enviados = 0;
      let tudoOk = true;
      for (const campo of CAMPOS) {
        const faltando = valoresFaltandoNoServidor(antigos[campo], servidor[campo]);
        if (Object.keys(faltando).length === 0) continue;
        if (await enviar(competencia, campo, faltando)) {
          enviados += Object.keys(faltando).length;
          if (ativo) setValores((v) => ({ ...v, [campo]: { ...faltando, ...v[campo] } }));
        } else {
          tudoOk = false;
        }
      }
      if (tudoOk) for (const campo of CAMPOS) removerAntigo(competencia, campo);
      if (ativo && enviados > 0) setMigrados(enviados);
    })();
    return () => {
      ativo = false;
    };
  }, [competencia]);

  return { valores, alterar, limpar, estado, migrados };
}
