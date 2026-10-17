# Análise do Horizonte

Atualização: os seis achados prioritários abaixo foram corrigidos e testados em 17/10/2026. Este documento preserva o diagnóstico original; veja CORRECOES_VALIDACAO.md para o comportamento final e as limitações.

Data: 17/10/2026. Escopo: leitura do código local e verificações automatizadas. Não foram realizados testes visuais, execução em celular, build nativo ou auditoria de vulnerabilidades de dependências. Nenhum código funcional foi alterado.

## Parecer

O Horizonte tem um escopo funcional amplo para gestão financeira pessoal, mas precisa de uma etapa de estabilização antes de se considerar confiável para registrar dados financeiros importantes. Os riscos mais relevantes estão na confirmação de pagamentos, integridade do backup e consistência entre o histórico e os saldos.

## Produto e arquitetura

- React Native 0.76.9, React 18.3.1, Expo declarado na série 52 e TypeScript em modo estrito.
- Expo Router para entrada, onboarding, criação e detalhes de transações; navegação interna entre áreas controlada por estado em app/index.tsx.
- Contas bancárias, cartões, receitas, despesas, transferências, parcelamentos, recorrências, projetos, metas, gráficos, projeções, temas e organização da tela inicial.
- Exportação CSV, backup JSON e lembretes locais.
- Dados mantidos em AsyncStorage. Não foi identificado backend próprio ou sincronização bancária no código de aplicação examinado.
- StoreContext compartilha o estado; hooks/useStore.ts concentra persistência e regras de negócio. O hook possui 1.272 linhas e HorizonteScreen.tsx possui 1.518 linhas.

Pontos positivos: separação de telas e componentes, contexto compartilhado, tipos centrais, suporte a temas e tentativa de reconstruir saldos a partir dos lançamentos. A suíte existente já exercita saldo, projetos e regras de fatura.

## Achados prioritários

### 1. Alta — vencimento é tratado como confirmação de pagamento

Evidência: hooks/useStore.ts:116–144 e chamada na linha 585.

Ao carregar os dados, autoProcessOverdueTransactions marca como paga qualquer transação pendente de conta que não seja cartão, com data até hoje. Isso inclui receitas ainda não recebidas e despesas ainda não pagas. Em seguida, recalcula os saldos.

Exemplo: um salário previsto para hoje e ainda não recebido passa a compor o saldo disponível após reabrir o aplicativo. Uma conta atrasada desaparece das pendências sem confirmação.

Encaminhamento: distinguir vencimento de liquidação. Se a baixa automática for uma escolha de produto, torná-la explícita e opcional.

### 2. Alta — backup não representa todos os dados do aplicativo

Evidência: components/screens/MenuScreen.tsx:267–275 e 362–373.

O backup inclui somente contas, lançamentos, etiquetas e orçamentos mensais. Omite projetos, metas, preferências de notificações, organização das telas e configurações financeiras. Os lançamentos ainda podem conter projectId e goalIds, que ficam sem seus respectivos cadastros ao restaurar em uma instalação limpa.

A restauração substitui apenas parte das chaves, podendo misturar dados anteriores com os importados. A validação verifica a presença de accounts e transactions, sem validar tipos, campos, datas ou referências. As gravações são sequenciais, sem recuperação em caso de falha intermediária. No celular, o estado em memória continua antigo até o usuário reiniciar o app.

Encaminhamento: definir um formato completo e versionado, validar o conteúdo antes de gravar e atualizar o estado após restaurar, com estratégia de recuperação de falhas.

### 3. Média — edição individual ignora a nova data

Evidência: app/add-transaction.tsx:304 e 325; hooks/useStore.ts:937–948.

O formulário envia a data editada, mas updateTransaction substitui esse campo por oldTx.date no modo individual. A operação aparenta salvar e fecha a tela, mantendo a data anterior. Isso prejudica correções de vencimento e organização por período.

Encaminhamento: aceitar a data enviada e tratar fuso horário separadamente.

### 4. Alta — limpeza de ajustes deixa saldos desatualizados

Evidência: hooks/useStore.ts:421–432, 71–113 e 1142–1145; components/screens/MenuScreen.tsx:154–176.

O saldo inicial é representado por um lançamento isAdjustment. purgeAdjustments remove esses registros, mas não recalcula as contas. O saldo exibido permanece antigo até uma operação posterior chamar syncBalances, quando pode mudar inesperadamente.

Exemplo: conta com saldo inicial de R$ 1.000 e nenhum outro lançamento. Depois de limpar os ajustes, pode continuar mostrando R$ 1.000; ao registrar uma receita de R$ 100, o saldo é reconstruído como R$ 100.

Encaminhamento: definir se limpar ajustes deve alterar o saldo ou preservar uma base inicial; aplicar a regra imediatamente e informar claramente o efeito.

### 5. Média — remoção de vínculos pode ser ignorada

Evidência: app/add-transaction.tsx:308–309; hooks/useStore.ts:934–939.

Ao remover o projeto ou todas as metas de um lançamento, o formulário envia undefined. A atualização individual filtra esses campos e mescla com o registro antigo. O vínculo anterior permanece.

Encaminhamento: distinguir campo não enviado de remoção explícita, por exemplo usando null para projeto e lista vazia para metas.

### 6. Média — metas incluem valores ainda não realizados

Evidência: hooks/useStore.ts:1171–1182.

getGoalSavedAmount soma todos os lançamentos vinculados, sem filtrar paid, data ou direção do movimento. Um aporte futuro pode aparecer como valor já guardado. O mesmo valor integral pode contar em várias metas se houver múltiplos vínculos.

Encaminhamento: separar aportes previstos e realizados e definir uma regra de distribuição entre metas.

## Qualidade e manutenção

- Regra de competência da fatura aparece em lib/utils.ts e novamente no hook, inclusive com estratégias diferentes de leitura da data. Centralizar essa regra reduz divergências de fuso e fechamento.
- A concentração de regras e persistência no hook torna alterações mais difíceis de isolar. Separar cálculos puros, armazenamento e operações de negócio facilitaria testes.
- Há usos de any para metas e layouts apesar da existência de interfaces. Isso reduz a proteção obtida pelo TypeScript estrito.
- A tela de criação chama operações assíncronas e volta imediatamente, sem aguardar a gravação. Falhas de armazenamento podem não ser informadas adequadamente ao usuário.
- Parcelas são calculadas por divisão simples do valor. Convém definir arredondamento em centavos e distribuição do resíduo para preservar o total exibido.
- package.json declara jest-expo em duas seções com séries diferentes: 52 em dependencies e 55 em devDependencies. Também existem package-lock.json e pnpm-lock.yaml. A instalação deve ter uma fonte de versões claramente definida.
- README descreve arquivos que não existem mais e afirma carregar dados de exemplo, mas os padrões de contas e lançamentos estão vazios.
- O backup JSON é gerado sem criptografia pela aplicação; seu conteúdo financeiro fica legível para quem tiver acesso ao arquivo.

## Verificações executadas

| Verificação | Resultado |
|---|---|
| TypeScript: tsc --noEmit | Aprovada, sem erros |
| Jest: npm test -- --runInBand | 7 testes: 6 passaram, 1 falhou |
| ESLint: npm run lint | Não executou: executável não instalado nesta cópia |

O teste que falhou espera gasto líquido de projeto de R$ 450, mas recebe R$ 500. O código separa receita e despesa em getProjectStats e retorna somente despesa em getProjectSpent; o teste espera dedução da receita. É necessário definir o contrato correto, sem presumir que o teste ou a implementação esteja necessariamente certo.

Os testes do hook também registram erro de carregamento porque o mock do AsyncStorage não implementa multiGet. A exceção é capturada pelo aplicativo, portanto alguns testes passam mesmo sem exercitar a inicialização real. Isso limita a confiança na cobertura atual.

## Ordem proposta de trabalho

1. Corrigir ou explicitar a baixa automática e estabilizar a relação entre ajustes, histórico e saldos.
2. Completar o backup/restauração e validar a recuperação em uma instalação limpa.
3. Corrigir edição de datas e remoção de vínculos; separar metas previstas e realizadas.
4. Corrigir a infraestrutura de testes e cobrir os cenários acima, incluindo falha de armazenamento e mudança de mês.
5. Separar as regras financeiras em módulos testáveis, unificar datas/faturas e atualizar a documentação.
6. Validar os principais fluxos em dispositivo, incluindo reinicialização, notificações e restauração.
