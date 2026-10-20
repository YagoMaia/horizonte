# Validação dos botões da tela Menu

Data: 18 de outubro de 2026

## Método

Cada controle da tela foi inventariado. Os fluxos internos foram acionados em teste de interface com dados e serviços simulados. As ações que dependem do Android foram verificadas até a chamada do serviço, sem abrir seletor de arquivo, painel de compartilhamento, diálogo de permissão ou notificação real no dispositivo.

## Resultado por grupo

| Grupo | Controles verificados | Resultado |
|---|---|---|
| Gerenciamento | Contas, Projetos, Metas, Categorias e Ajustes de saldo | As três navegações chamam o destino correto; Categorias e Ajustes abrem seus modais. |
| Aparência | Personalizar tela inicial, Personalizar Totais, Tema, três opções de tema, fechar modal, Cor principal, opções de cor e fechar modal | Navegações e seleção de tema foram exercitadas. As opções de cor e os fechamentos têm fluxo direto no código: gravam a escolha ou fecham o modal. |
| Horários | Três ícones de edição; aumentar/diminuir hora; aumentar/diminuir minuto; Cancelar e Salvar | Os três editores abrem e salvam no campo correto. Os controles de incremento usam ciclos válidos: hora de 0 a 23 e minuto de 0 a 55 em passos de cinco. |
| Lembretes | Três interruptores | Cada interruptor chama a preferência correspondente após a verificação de permissão. A análise anterior registra que a mesma permissão é solicitada também ao desativar. |
| Teste de notificação | Enviar notificação de teste | O acionamento foi simulado. A notificação real exige a permissão e o Android em primeiro plano ou segundo plano para confirmação visual. |
| Backup e exportação | Criar backup, Restaurar backup, Exportar CSV | Os botões foram acionados em ambiente simulado; a restauração cancelada não chama a substituição de dados. Seletor de arquivo, compartilhamento e gravação física exigem teste no aparelho. |
| Manutenção | Sincronizar saldos, Limpar ajustes, Limpar todos os dados | As três ações exibem confirmação. A função só é acionada quando a opção de confirmação é escolhida; nenhuma alteração foi aplicada aos dados reais. |

## Testes adicionados

`__tests__/menu.test.tsx` cobre os grupos de navegação, abertura de modais, edição de horário, três interruptores, acionamento de backup/restauração/exportação e confirmações de manutenção.

## Limitações verificadas

Não foi possível confirmar nesta máquina a interface do seletor de documentos, o compartilhamento de arquivo, a permissão do Android ou a entrega da notificação após cinco segundos. Esses controles chegam corretamente aos seus serviços no aplicativo, mas a etapa final depende do Android e deve ser conferida em um S23 físico.

## Achados mantidos

Os problemas registrados em `ANALISE_TELA_MENU.md` permanecem: exportação CSV com data vulnerável ao fuso, campos sem codificação completa, transferência exportada como despesa, permissões solicitadas ao desativar lembretes e ausência de estado de processamento para operações de arquivo.
