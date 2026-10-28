# Compras por notificação — implementação Android

## Como usar

1. Gere e instale um novo APK com `npm run build:apk`. O módulo nativo não existe no APK anterior, Expo Go ou web.
2. Abra Menu → Importar compras de notificações.
3. Escolha o aplicativo instalado do banco, ative a captura e configure crédito e débito separadamente: Desativado, Revisar antes ou Automático.
4. Selecione um cartão para crédito e uma conta de caixa para débito. Salve as regras.
5. Use Autorizar acesso no Android e conceda acesso ao Horizonte na tela do sistema. A permissão de enviar notificações é diferente desse acesso.
6. Faça uma compra de teste e confira a importação e o destino. Textos que não informam claramente modalidade, valor ou parcelas são enviados para revisão.

## Comportamento

- Crédito importado não marca a fatura como paga; débito confirmado vira despesa realizada.
- Recusa, estorno, cancelamento e pagamento de fatura não são interpretados como compra.
- Sem identificação segura de conta/cartão cadastrado, o lançamento fica para revisão.
- Parcelas não são inventadas: notificações que indicam parcelamento vão para revisão. Nessa tela é possível conferir os dados, confirmar uma despesa simples ou descartar e usar o formulário de parcelas.
- A configuração é por aplicativo e modalidade. Ela usa o destino padrão explicitamente escolhido pelo usuário, não consulta contas bancárias.
- Com o app aberto, verifica a fila a cada 10 segundos e ao retornar ao primeiro plano. Com o app fechado, o serviço Android armazena capturas e o processamento ocorre ao reabrir. Não há execução permanente do JavaScript com o app fechado.
- Não importa notificações históricas ao conceder acesso. O reconhecimento depende do conteúdo que o Android e o aplicativo emissor disponibilizam.

## Dados e integridade

- Fila nativa privada em SharedPreferences, somente para pacotes explicitamente ativados, sem servidor ou chamada à API bancária.
- Leitura e escrita da fila são sincronizadas; disco é acessado fora da thread principal no listener.
- Ignora resumos de grupos de notificações. Usa pacote, chave Android e horário do evento para reconhecer reentregas.
- Retira uma captura da fila apenas após gravar o lançamento ou sugestão/decisão de ignorar. `notificationImportId` no lançamento impede repetição após falha entre a gravação financeira e a confirmação da fila.
- Limite de 1000 capturas nativas. A tela informa perdas por excesso de fila, se houver.
- Limpar todos os dados também apaga regras/fila local e desativa pacotes selecionados. O acesso concedido no Android pode ser revogado na tela do sistema.
- As regras/capturas não integram o backup financeiro existente; a associação aos aplicativos deve ser configurada no aparelho. Os lançamentos já confirmados e seu identificador de origem fazem parte dos dados financeiros.

## Arquivos

- `modules/notification-capture`: módulo Expo local Android, serviço e fila.
- `lib/purchaseImport.ts`: reconhecimento conservador e tipos.
- `context/PurchaseImportContext.tsx`: processamento serializado, revisão e preferências.
- `app/notification-import.tsx`: interface acessível com modos independentes e revisão.
- `hooks/useStore.ts`: idempotência na fila financeira e evento de limpeza.

## Verificações e limites

- TypeScript: aprovado.
- Expo Autolinking reconheceu o módulo local e a classe `expo.modules.horizontecapture.CaptureModule`.
- Suíte completa anterior à última adição de dois testes de interface: 24 suítes/166 testes aprovados. Quatro testes privados ignorados por backup indisponível.
- Testes de interface adicionais verificam os modos independentes e a indicação de módulo indisponível.
- A parte Kotlin não foi compilada neste ambiente: SDK Android localizado, mas JDK/Java não disponível. Nenhum APK foi gerado nesta tarefa. É necessária a compilação EAS e validação no S23 antes de considerar a captura nativa validada.
- Verificar no aparelho: autorização, captura com app fechado/aberto, retorno ao app, texto real do banco, atualização da mesma notificação, revisão, crédito/débito, revogação do acesso e reinicialização.

## Referências oficiais

- Android NotificationListenerService: https://developer.android.com/reference/android/service/notification/NotificationListenerService
- Módulos locais Expo: https://docs.expo.dev/modules/get-started/
- Autolinking Expo: https://docs.expo.dev/modules/autolinking/
