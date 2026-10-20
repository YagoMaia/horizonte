# Análise da tela Menu

Data: 18 de outubro de 2026  
Escopo: navegação, configurações, notificações, backup, exportação, manutenção de dados, responsividade e acessibilidade. Esta entrega é diagnóstica e não altera o funcionamento da tela.

## Papel da tela

O Menu reúne configurações de conta e aparência, personalização de telas, lembretes, backup, exportação e ações de manutenção. A divisão por seções é clara e as ações principais de gerenciamento levam aos módulos corretos.

Como ela contém operações que podem alterar ou apagar dados, a previsibilidade dos fluxos e a segurança de interação são mais importantes aqui do que a densidade visual.

## Pontos positivos

- As áreas de gerenciamento, aparência, notificações e backup são separadas visualmente.
- A restauração valida o formato do backup antes de confirmar a substituição.
- A restauração informa quando o arquivo é legado e pode não conter todos os cadastros.
- A exclusão total pede confirmação e recomenda criar um backup.
- A estrutura em rolagem funciona em telas pequenas, incluindo o Galaxy S23.

## Problemas confirmados

| Prioridade | Problema | Efeito prático |
|---|---|---|
| Alta | A exportação CSV interpreta datas com `new Date(data)`, que desloca datas no formato `AAAA-MM-DD` no fuso do Brasil. | Um lançamento pode ser exportado com o dia anterior ao registrado. |
| Alta | A exportação CSV não protege campos com aspas, quebras de linha ou fórmulas iniciadas por `=`, `+`, `-` ou `@`. | A planilha pode ter colunas quebradas ou executar fórmulas ao ser aberta no Excel. |
| Alta | Transferências são exportadas como “Despesa”. | O relatório exportado perde a natureza real da transação e pode induzir análise incorreta. |
| Média | Desativar um lembrete solicita permissão de notificação antes de aplicar a mudança. | Uma pessoa que negou a permissão não consegue desligar uma preferência já marcada. |
| Média | O horário configurado dos lembretes não aparece na tela. | O ícone de edição não informa o horário ativo, dificultando conferir a configuração. |
| Média | O botão de teste tenta agendar uma notificação sem solicitar permissão primeiro. | O teste pode falhar sem orientar claramente como corrigir a permissão. |
| Média | Restaurar backup, exportar, criar backup e limpar dados não mostram estado de processamento nem bloqueiam toques repetidos. | Toques consecutivos podem abrir fluxos duplicados e não há retorno visual durante operações mais longas. |
| Média | “Limpar Ajustes de Saldo” é uma ação destrutiva, mas não é apresentada visualmente como tal. | Pode ser acionada por engano junto de ações normais de manutenção. |
| Média | Não há testes automatizados específicos para Menu, incluindo exportação, permissão, confirmação e restauração. | Regressões em funções sensíveis aos dados não são detectadas antes de uma entrega. |
| Baixa | Itens de menu, ícones de edição, opções de modal e ações de manutenção não possuem rótulos de acessibilidade consistentes. | Leitores de tela têm menos contexto e alguns controles pequenos são difíceis de operar. |
| Baixa | Os ícones de edição de horário têm 28 px. | A área é pequena para toque confortável em celulares. |
| Baixa | O texto “Tema escuro” acompanha valores “Claro” e “Automático”. | A nomenclatura pode confundir sobre o que será alterado. |

## Evidências técnicas

### Exportação

O CSV é montado diretamente no componente. A data é convertida por `new Date(tx.date)`; esse padrão já causou deslocamento de data na tela Totais e tem o mesmo efeito para datas sem horário. A descrição troca somente ponto e vírgula por vírgula, sem escapar aspas, linhas novas ou fórmulas. Além disso, qualquer tipo que não seja receita é exportado como despesa, incluindo transferências.

### Notificações

Os três interruptores chamam `requestPermissions()` em toda alteração de valor. Essa solicitação é apropriada ao ativar um lembrete, mas não ao desativá-lo. Os horários são mantidos no estado, porém `formatTime` existe sem ser usado na interface: o usuário vê apenas o ícone de lápis.

### Manutenção de dados

Backup e restauração usam validação, o que é uma boa base. Ainda falta um estado de operação para desabilitar os botões enquanto o arquivo é lido, gravado, compartilhado ou restaurado. A ação de limpar ajustes remove inclusive saldos iniciais, mas não usa cor ou texto de ação destrutiva na lista.

### Uso móvel e acessibilidade

As linhas principais têm altura suficiente para toque e o conteúdo possui rolagem. Os ícones de edição de horário e as setas do seletor de horário são menores que a área de toque recomendada. `MenuItem` não define papel ou rótulo de acessibilidade; os modais também dependem somente de texto visual para contextualizar as opções.

## Correções recomendadas

1. Extrair a exportação CSV para uma função pura, usar `financialDate` e codificar corretamente cada célula, incluindo proteção contra fórmulas.
2. Exportar explicitamente Receita, Despesa e Transferência.
3. Solicitar permissão somente ao ativar notificações e solicitar permissão antes do teste de notificação.
4. Exibir o horário ativo ao lado de cada lembrete e ampliar os controles de edição.
5. Criar estado de processamento para backup, restauração, exportação e limpeza; desabilitar a ação enquanto ela estiver em execução.
6. Destacar e confirmar novamente a limpeza de ajustes de saldo, com explicação do impacto.
7. Adicionar papéis, rótulos e estados de acessibilidade aos itens, interruptores, modais e controles de horário.
8. Criar testes para CSV, permissões, restauração inválida, cancelamento e ações destrutivas.

## Ordem sugerida

Começar pela exportação, pois ela altera dados ao sair do aplicativo e hoje pode gerar relatório incorreto. Em seguida, corrigir notificações e o feedback das operações de backup. Por fim, aplicar os ajustes de acessibilidade e apresentação das ações de manutenção.
