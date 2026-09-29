const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function fmt(n: number): string {
  return currency.format(n);
}

interface ProvisaoMensalView {
  competencia: string;
  provFerias: number;
  prov13: number;
}

interface DescontoSaldoView {
  competencia: string;
  tipo: "ferias" | "terco";
  valor: number;
}

/** Histórico mês a mês da provisão de férias/13º que a Folha gerou pra esse colaborador — salvo automaticamente a cada Folha enviada (ver provisoesMensais.ts) — menos o que já foi pago via Desconto de saldo (ver descontosSaldo.ts). Líquido no rodapé é a base pra calcular uma rescisão. */
export function RescisaoCard({ provisoes, descontos }: { provisoes: ProvisaoMensalView[]; descontos: DescontoSaldoView[] }) {
  const totalProvFerias = provisoes.reduce((soma, p) => soma + p.provFerias, 0);
  const totalProv13 = provisoes.reduce((soma, p) => soma + p.prov13, 0);
  const totalDescontoFerias = descontos.filter((d) => d.tipo === "ferias").reduce((soma, d) => soma + Math.abs(d.valor), 0);
  const totalDesconto13 = descontos.filter((d) => d.tipo === "terco").reduce((soma, d) => soma + Math.abs(d.valor), 0);
  const liquidoFerias = totalProvFerias - totalDescontoFerias;
  const liquido13 = totalProv13 - totalDesconto13;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">Rescisão — provisão acumulada</h2>
      <p className="text-xs text-neutral-500">
        Prov. Férias e Prov. 13º que a Folha (fechamento) gerou pra esse colaborador, mês a mês, menos o que já foi
        pago via Desconto de saldo (esse dinheiro já foi quitado com ele) — salvo sozinho a cada Folha enviada ou
        desconto lançado, sem precisar digitar nada aqui. O líquido no rodapé é a base pra calcular uma rescisão.
      </p>
      {provisoes.length === 0 ? (
        <p className="text-sm text-neutral-400">Nenhuma Folha enviada ainda pra esse colaborador.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Competência</th>
                <th className="px-3 py-2 text-right font-medium">Prov. Férias</th>
                <th className="px-3 py-2 text-right font-medium">Prov. 13º</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {provisoes.map((p) => (
                <tr key={p.competencia} className="hover:bg-neutral-50">
                  <td className="px-3 py-2">{p.competencia}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(p.provFerias)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(p.prov13)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-300 bg-neutral-50 text-neutral-700">
                <td className="px-3 py-2">Subtotal provisão</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(totalProvFerias)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(totalProv13)}</td>
              </tr>
              <tr className="text-neutral-700">
                <td className="px-3 py-2">(−) Desconto já lançado</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(totalDescontoFerias)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(totalDesconto13)}</td>
              </tr>
              <tr className="border-t border-neutral-300 bg-neutral-50 font-semibold text-neutral-900">
                <td className="px-3 py-2">Acumulado líquido</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(liquidoFerias)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{fmt(liquido13)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
