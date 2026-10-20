# Correções da tela Cartões

Estado: concluída em 18/10/2026.
Solicitação: corrigir os problemas da análise de Cartões, validar com backup privado e manter responsividade móvel, com S23 como referência.

## Entrega

Índice compartilhado de faturas, competência de vencimento, datas válidas, créditos legados e centavos. Pagamentos com validação, bloqueio de concorrência, diário de recuperação e estorno vinculado. Exclusão com escopo explícito. Tela com modais roláveis, seleção de mês, privacidade compartilhada e preservação de contexto.

Arquivos principais: lib/cardInvoices.ts, lib/cardPayment.ts, lib/ledgerStorage.ts, hooks/useStore.ts, components/screens/CartaoScreen.tsx, lib/financialIndex.ts. Integrações com Saldos, projeções, backup e edição de transações. Relatório em CORRECOES_CARTOES.md.

## Verificações

TypeScript, 11 suítes/74 testes e git diff --check aprovados em 18/10/2026. Backup privado habilitado por HORIZONTE_TEST_BACKUP, sem alteração do original. Novas suítes cardInvoices, cardStore e cartoes; teste de backup simula pagamento e confere saldo contra dívida.

Web: 320×640, 360×780, 412×915 e 780×360. Formulários, competência, troca de aba e privacidade verificados. Evidência: cartoes-mobile-validacao.png, com valores ocultos.

## Limitações

Sem execução no S23 físico, medição de FPS ou geração/instalação de APK. ESLint indisponível. Estorno de pagamentos legados sem vínculo não é inferido. Não houve operação bancária, commit ou publicação.
