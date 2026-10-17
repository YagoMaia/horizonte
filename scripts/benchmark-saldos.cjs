// Benchmark local do processamento de dados; não mede FPS ou desempenho nativo.
const fs = require('fs');
const ts = require('typescript');
const { performance } = require('perf_hooks');
const path = require('path');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
};
const { buildFinancialIndex, filterMonth, DEFAULT_SALDOS_FILTERS } = require('../lib/financialIndex.ts');
const today = new Date(2026, 9, 17, 12);
const size = Number(process.argv[2]) || 50000;
const accounts = Array.from({ length: 40 }, (_, i) => ({ id: `a${i}`, name: `Conta ${i}`, type: 'corrente', balance: 0, color: '#000', icon: 'wallet' }));
const projects = Array.from({ length: 40 }, (_, i) => ({ id: `p${i}` }));
const goals = Array.from({ length: 40 }, (_, i) => ({ id: `g${i}`, savedAmount: 0 }));
const transactions = Array.from({ length: size }, (_, i) => ({ id: `${i}`, description: `Movimento ${i}`, accountId: `a${i % 40}`, projectId: `p${i % 40}`, goalIds: [`g${i % 40}`], date: new Date(2023 + Math.floor(i / 336) % 4, Math.floor(i / 28) % 12, 1 + i % 28, 12).toISOString(), amount: 10 + i % 100, type: i % 3 ? 'despesa' : 'receita', paid: i % 5 !== 0, recurrence: 'unica' }));
function legacyPrepare() {
  const untilToday = transactions.filter(t => new Date(t.date) <= new Date(2026, 9, 17, 23, 59, 59));
  const balances = accounts.map(a => untilToday.reduce((sum, t) => !t.paid || t.accountId !== a.id ? sum : sum + (t.type === 'receita' ? t.amount : -t.amount), 0));
  const projectTotals = projects.map(p => transactions.filter(t => t.projectId === p.id).reduce((s, t) => s + t.amount, 0));
  const goalTotals = goals.map(g => transactions.filter(t => t.goalIds.includes(g.id)).reduce((s, t) => t.paid && new Date(t.date) <= today ? s + t.amount : s, 0));
  return { balances, projectTotals, goalTotals };
}
function legacyFilter() {
  return transactions.filter(t => { const d = new Date(t.date); return d.getFullYear() === 2026 && d.getMonth() === 9; }).sort((a, b) => new Date(b.date) - new Date(a.date));
}
function measure(fn) {
  fn();
  const times = Array.from({ length: 7 }, () => { const start = performance.now(); fn(); return performance.now() - start; }).sort((a, b) => a - b);
  return Number(times[3].toFixed(3));
}
const prepared = buildFinancialIndex(accounts, transactions, goals, today);
const old = legacyPrepare();
if (filterMonth(prepared, '2026-10', DEFAULT_SALDOS_FILTERS).length === 0) throw new Error('O cenário deve conter lançamentos no mês consultado');
accounts.forEach((a, i) => { if (prepared.balances.get(a.id) !== old.balances[i]) throw new Error('Divergência nos saldos comparados'); });
const results = {
  transactions: size, accounts: accounts.length, projects: projects.length, goals: goals.length,
  medianMs: {
    previousPreparation: measure(legacyPrepare), indexedPreparation: measure(() => buildFinancialIndex(accounts, transactions, goals, today)),
    previousMonthSelection: measure(legacyFilter), indexedMonthSelection: measure(() => filterMonth(prepared, '2026-10', DEFAULT_SALDOS_FILTERS)),
    previousFormatting1000: measure(() => { for (let i = 0; i < 1000; i++) new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(i); }),
    cachedFormatting1000: measure(() => { const { formatCurrency } = require('../lib/utils.ts'); for (let i = 0; i < 1000; i++) formatCurrency(i); }),
  },
  note: 'Mediana de 7 execuções após aquecimento no Node local. Inclui cálculo e indexação, não renderização nem FPS no celular. Referência anterior reproduz os laços de contas, projetos e metas; diferenças de regras de negócio não são medidas de UX.',
};
console.log(JSON.stringify(results, null, 2));
if (process.argv[3]) fs.writeFileSync(path.resolve(process.argv[3]), JSON.stringify(results, null, 2));
