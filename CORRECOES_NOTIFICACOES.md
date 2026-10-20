# Correções de notificações

Data: 20/10/2026

## Alterações implementadas

- O canal Android é criado antes da consulta e do pedido de permissão.
- A permissão não é mais solicitada na abertura do aplicativo. Ela aparece quando a pessoa ativa um lembrete ou envia a notificação de teste.
- Os três lembretes usam o gatilho diário tipado do Expo, com horário e canal explícitos.
- A notificação de teste usa o gatilho de intervalo de cinco segundos correto.
- Erros de agendamento deixam de ser ocultados. A preferência e o horário só são gravados após o agendamento ou cancelamento concluir.
- Novas instalações começam com lembretes desligados, evitando estado visual enganoso sem autorização.
- Dados restaurados só recriam os lembretes quando a permissão já está concedida.
- A limpeza de todos os dados cancela os três lembretes antes de apagar os identificadores locais.
- O controle de lembrete de vencimento no cadastro de lançamento foi removido porque não tinha implementação.
- Os textos de despesas e cartões agora descrevem lembretes gerais, sem prometer alertas automáticos por vencimento.
- A configuração Expo inclui o plugin de notificações e o canal padrão para a próxima compilação Android.

## Testes

- TypeScript: aprovado.
- Configuração Expo: aprovada.
- Jest com backup privado local: 17 suítes e 101 testes aprovados.
- Foram adicionados testes para canal antes da permissão, agendamento diário tipado, erro propagado, cancelamento, estado inicial e teste de cinco segundos.

## Próxima validação necessária

Gerar e instalar um novo APK no Galaxy S23. No aparelho, ativar um lembrete, confirmar a permissão, usar “Enviar Notificação de Teste”, ocultar o aplicativo e aguardar cinco segundos. Depois, verificar os horários diários e o comportamento com economia de bateria.

