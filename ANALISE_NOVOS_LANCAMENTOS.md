# Análise — criação de novos lançamentos

Data: 28/10/2026. Escopo: formulário `app/add-transaction.tsx` e persistência/geração em `hooks/useStore.ts`. Esta etapa é uma análise; não altera o funcionamento do aplicativo.

## 1. Parcelas podem pular faturas ou se acumular na mesma competência — prioridade alta

A geração usa uma regra própria de fechamento e coloca as parcelas seguintes no primeiro dia de meses calculados. Depois, a classificação da fatura aplica novamente o fechamento à data gerada. As regras divergem também quando o fechamento cadastrado não existe no mês.

Reproduções automatizadas:

- Fechamento dia 1, vencimento dia 10, compra em 01/10/2026 em três parcelas: deveriam ocupar novembro, dezembro e janeiro. O código gera novembro, janeiro e fevereiro; dezembro fica sem a parcela.
- Fechamento dia 31, vencimento dia 5, compra em 28/02/2026 em três parcelas: pelas regras atuais de fechamento, deveriam ocupar abril, maio e junho. O código gera abril, abril e maio; duas parcelas acumulam na primeira fatura.

Correção necessária: usar um cálculo único de competência, incluindo ajuste do fechamento para o último dia do mês, e atribuir uma competência explícita e consecutiva a cada parcela. Preservar a data da compra para não recalcular a competência a partir de datas artificiais. Revisar também a edição de famílias, que repete a estratégia.

Referências: `hooks/useStore.ts:717`, `hooks/useStore.ts:722`, `hooks/useStore.ts:731`, `lib/utils.ts:20` e `hooks/useStore.ts:927`.

## 2. Gravações podem sobrescrever um lançamento recém-criado — prioridade alta

`addTransaction` monta a nova lista com a variável `transactions` capturada na renderização. Se a mesma função for chamada duas vezes antes de receber um estado atualizado, a segunda gravação usa a lista antiga. A reprodução com duas chamadas aguardadas antes da nova renderização termina com apenas o segundo lançamento.

A proteção `savingRef` evita o duplo toque no mesmo formulário, mas não protege globalmente as gravações. O botão de fechar permanece disponível durante o salvamento, permitindo sair e abrir outro formulário enquanto a primeira ação ainda está em andamento. Essa interação é um risco identificado pelo código; não foi reproduzida fisicamente no S23.

Correção necessária: enfileirar as escritas financeiras, ler a referência atual dentro da operação e impedir saída involuntária durante gravação. Gerar identificadores exclusivos além de `Date.now()`, também usado para famílias.

Referências: `hooks/useStore.ts:841`, `hooks/useStore.ts:844`, `hooks/useStore.ts:833`, `app/add-transaction.tsx:282` e `app/add-transaction.tsx:391`.

## 3. Recorrência sem data final encerra após 24 ocorrências sem informar — prioridade média

O campo termina em é opcional, mas o formulário define `calculatedMaxRecurrences = 24`, e o armazenamento gera no máximo esse número. Não há mensagem que explique esse término automático nem rotina de extensão encontrada no fluxo revisado.

Reprodução: uma recorrência diária iniciada em 28/10/2026, sem término, produz 24 lançamentos e termina em 20/11/2026. Uma recorrência mensal gera aproximadamente dois anos; uma semanal, aproximadamente seis meses. O usuário pode interpretar a ausência de data final como repetição contínua e obter uma projeção incompleta.

Correção necessária: informar e permitir escolher o limite, ou implementar extensão da série por um horizonte de planejamento. Revisar a contagem quando a primeira ocorrência é descartada por ser anterior ao início, como no quinto dia útil.

Referências: `app/add-transaction.tsx:324`, `app/add-transaction.tsx:369` e `hooks/useStore.ts:762`.

## 4. Acessibilidade e áreas de toque insuficientes — prioridade média

Os controles principais não têm descrições ou papéis acessíveis explícitos: fechar, salvar, calendário, seleção de contas, tipo e repetições. Os campos dependem de textos visuais e placeholders; o interruptor Pago / Recebido não possui um nome acessível associado. O fechamento do cabeçalho é um ícone sem descrição. Seleções de contas/categorias dependem principalmente de cor, sem estado de seleção exposto ao leitor de tela.

Vários controles usam somente preenchimento curto, sem área mínima de toque. Nome longo da conta e texto ampliado também precisam ser verificados.

Correção necessária: adicionar nomes, papéis, seleção/desabilitação acessíveis, associar campos a rótulos e assegurar áreas de toque adequadas sem limitar o tamanho da fonte.

Referências: `app/add-transaction.tsx:391`, `app/add-transaction.tsx:402`, `app/add-transaction.tsx:636`, `app/add-transaction.tsx:653`, `app/add-transaction.tsx:673` e `app/add-transaction.tsx:684`.

## 5. Teclado e calendário precisam de validação móvel adicional — prioridade média

O formulário usa comportamento de teclado apenas no iOS; no Android, deixa-o indefinido. Isso, isoladamente, não comprova sobreposição, pois depende de como a janela nativa redimensiona. O calendário tem largura proporcional e conteúdo sem rolagem ou altura máxima; a navegação rápida usa altura fixa de 320. Há risco de corte em telas baixas e fonte ampliada.

Correção recomendada: verificar no S23 e em larguras menores, com teclado e fonte ampliada; adaptar o calendário para altura disponível e conteúdo rolável quando necessário. A rolagem do formulário e a margem inferior segura já existem.

Referências: `app/add-transaction.tsx:388`, `app/add-transaction.tsx:209` e `app/add-transaction.tsx:697`.

## Pontos já protegidos

- Valor vazio, zero e inválido impedem salvamento.
- Transferência exige destino válido e diferente da origem; cartão não é oferecido como destino.
- Salvamento aguarda persistência, bloqueia toque duplo no mesmo formulário e informa falhas.
- As parcelas distribuem os centavos sem alterar o valor total.
- Recorrência respeita a data final; dias úteis pulam fins de semana.
- Lançamentos e contas são gravados com diário financeiro recuperável.
- Projetos e metas são enviados como vínculos; descrições vazias são permitidas pelo próprio formulário, que as apresenta como opcionais.

## Verificações realizadas

- 14 testes existentes de formulário e regressões passaram.
- Quatro experimentos temporários: três reproduziram falhas (duas competências de parcelamento e sobrescrita de lançamento); o quarto confirmou o limite de 24 ocorrências. Os arquivos temporários foram removidos após a auditoria.
- TypeScript verificado separadamente.
- Não houve teste físico no S23 nem inspeção visual no aplicativo nesta etapa. O backup privado não foi usado, pois não está disponível no caminho original.

## Ordem de correção sugerida

1. Competências das parcelas e reaplicação das regras de fechamento.
2. Serialização de gravações e identificadores exclusivos.
3. Regra explícita para recorrências sem término.
4. Acessibilidade, áreas de toque e validação de teclado/calendário no Android.

## Atualização — correções implementadas

Em 28/10/2026, os pontos desta análise receberam correções de código e testes. Consulte `CORRECOES_LANCAMENTOS.md` para a implementação, validação e limites. A validação física no S23 permanece pendente por indisponibilidade do aparelho nesta sessão.
