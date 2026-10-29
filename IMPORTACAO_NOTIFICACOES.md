# Compras por notificação — implementação Android

## Como usar

1. Gere e instale um novo APK com `npm run build:apk`. O módulo nativo não existe no APK anterior, Expo Go ou web.
2. Abra Menu → Importar compras de notificações.
3. Escolha o aplicativo instalado do banco, ative a captura e configure crédito e débito separadamente: Desativado, Revisar antes ou Automático.
4. Associe os finais de quatro dígitos aos cartões/contas correspondentes. O mesmo aplicativo pode ter vários destinos, e cartões virtuais podem ter vários finais, separados por vírgula. Selecione também o destino padrão. Compras sem final exigem revisão, exceto se você ativar explicitamente a opção de usar o destino padrão sem identificação. Final diferente dos cadastrados sempre exige revisão. Salve as regras.
5. Use Autorizar acesso no Android e conceda acesso ao Horizonte na tela do sistema. A permissão de enviar notificações é diferente desse acesso.
6. Faça uma compra de teste e confira a importação e o destino. Textos que não informam claramente modalidade, valor ou parcelas são enviados para revisão.

## Comportamento

- Crédito importado não marca a fatura como paga; débito confirmado vira despesa realizada.
- Recusa, estorno, cancelamento e pagamento de fatura não são interpretados como compra.
- Sem identificação segura de conta/cartão cadastrado, o lançamento fica para revisão.
- Notificações parceladas vão para revisão. Informe a quantidade e escolha se o valor representa o total ou cada parcela. O app exibe o total e registra a família de parcelas pelo mesmo mecanismo do formulário completo, dividindo os centavos e respeitando as competências. Parcelamento é permitido somente no crédito.
- A configuração é por aplicativo e modalidade, com associação de finais a destinos compatíveis. Não consulta contas bancárias nem adivinha qual cartão emitiu uma mensagem sem final.
- Mensagens genéricas de pagamento aprovado/realizado no crédito ou débito podem ser revisadas, mas nunca automatizadas apenas por esse texto. Faturas, boletos, PIX, transferências, recebimentos, recusas, cancelamentos e estornos não viram compras. Textos reais de cada banco ainda precisam ser conferidos; não há promessa de compatibilidade universal.
- Com o app aberto, verifica a fila a cada 10 segundos e ao retornar ao primeiro plano. Com o app fechado, o serviço Android armazena capturas e o processamento ocorre ao reabrir. Não há execução permanente do JavaScript com o app fechado.
- Não importa notificações históricas ao conceder acesso. O reconhecimento depende do conteúdo que o Android e o aplicativo emissor disponibilizam.

## Dados e integridade

- Fila nativa privada em SharedPreferences, somente para pacotes explicitamente ativados, sem servidor ou chamada à API bancária.
- Leitura e escrita da fila são sincronizadas; disco é acessado fora da thread principal no listener.
- Filtra os aplicativos selecionados antes de extrair o texto e ignora resumos de grupos. Usa pacote, chave Android, horário e conteúdo para reconhecer reentregas sem perder mensagens alteradas que reutilizem chave/horário.
- Retira uma captura da fila apenas após gravar o lançamento ou sugestão/decisão de ignorar. `notificationImportId` no lançamento impede repetição após falha entre a gravação financeira e a confirmação da fila.
- Além do identificador do evento, a gravação financeira confere despesas de mesmo valor/conta no mesmo dia ou em dias adjacentes, inclusive lançamentos manuais e o total de famílias parceladas. Semelhança gera revisão e exige confirmar que é outra compra; não mescla nem apaga compras legítimas. A conferência ocorre dentro da fila financeira para impedir que capturas simultâneas passem juntas.
- Limite de 1000 capturas nativas. A tela informa perdas por excesso de fila. O processamento usa lotes de até 25; chamadas repetidas não acumulam trabalhos simultâneos. Até 200 pendências ficam disponíveis para revisão e o excedente aguarda na fila nativa. Legado acima de 200 é preservado e precisa diminuir antes de novas entradas.
- Corpos de pendências são gravados separadamente; apenas novos/alterados são escritos. O índice mantém até 4000 identificadores recentes. Ao compactar o histórico, registra um limite temporal: capturas anteriores só podem ir para revisão. Capturas com mais de 30 dias também não são automatizadas. A tela mostra até 20 pendências/aplicativos por página.
- Ao salvar regras, pausa a captura antes da gravação. Falhas de aplicação são reconciliadas com as regras persistidas na próxima atualização/abertura; regras inalteradas não são regravadas no Android a cada verificação. Falhas nativas de confirmação/configuração/limpeza são informadas ao JavaScript.
- Limpar todos os dados pausa as importações, aguarda trabalhos em andamento, desativa a captura e limpa regras/fila antes de remover os dados financeiros dentro da fila de gravação. Uma marca persistente bloqueia a importação após uma limpeza interrompida; repita a limpeza para concluir. O acesso concedido no Android pode ser revogado na tela do sistema.
- As regras/capturas não integram o backup financeiro existente; a associação aos aplicativos deve ser configurada no aparelho. Os lançamentos já confirmados e seu identificador de origem fazem parte dos dados financeiros.

## Arquivos

- `modules/notification-capture`: módulo Expo local Android, serviço e fila.
- `lib/purchaseImport.ts`: reconhecimento conservador e tipos.
- `context/PurchaseImportContext.tsx`: processamento serializado, revisão e preferências.
- `lib/purchaseImportStorage.ts`: índice limitado, migração e persistência incremental das pendências.
- `lib/purchaseImportLifecycle.ts`: barreira de execução para limpeza segura.
- `app/notification-import.tsx`: interface acessível com modos independentes e revisão.
- `hooks/useStore.ts`: idempotência na fila financeira e evento de limpeza.

## Verificações e limites

- TypeScript aprovado em 29/10/2026.
- Suíte completa: 27 suítes/191 testes aprovados. Quatro testes privados ignorados por backup indisponível.
- Recorte específico: 57 testes aprovados em seis suítes, incluindo armazenamento, falhas e integração real dos providers com persistência simulada.
- Expo Autolinking reconheceu o módulo local e a classe `expo.modules.horizontecapture.CaptureModule`.
- Compilação Kotlin do módulo aprovada via Gradle, incluindo CaptureModule, CaptureQueue e PurchaseListener. Java 17 foi localizado em uma instalação do Gradle fora do PATH; não foi necessário instalar Java.
- Processamento do manifesto principal Android aprovado, integrando o serviço de captura à aplicação.
- Nenhum APK foi gerado nesta tarefa e nenhum aparelho estava conectado pelo ADB. A compilação não substitui a validação da captura no S23.
- Verificar no aparelho: autorização, captura com app fechado/aberto, retorno ao app, texto real do banco, atualização da mesma notificação, revisão, crédito/débito, revogação do acesso e reinicialização.

## Referências oficiais

- Android NotificationListenerService: https://developer.android.com/reference/android/service/notification/NotificationListenerService
- Módulos locais Expo: https://docs.expo.dev/modules/get-started/
- Autolinking Expo: https://docs.expo.dev/modules/autolinking/
