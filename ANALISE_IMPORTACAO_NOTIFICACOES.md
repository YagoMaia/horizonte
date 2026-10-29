# Revisão da importação de notificações — 29/10/2026

Escopo: leitura do código da captura Android, processamento, integração financeira e interface. Não constitui nova auditoria completa das demais telas. Nenhuma alteração funcional nesta revisão.

## Achados prioritários

1. **Alta — associação automática pode usar o cartão errado.** `lib/purchaseImport.ts:17` extrai modalidade, mas não final de cartão/identificador de conta. `context/PurchaseImportContext.tsx:23` e o processamento usam apenas o destino padrão da modalidade. Uma mensagem de outro cartão do mesmo banco também pode ser importada nesse destino. Experimento sintético confirmou que uma compra com `cartao final 9999` continua elegível à automação sem conferir esse final. Implementar associação explícita e revisão quando não houver correspondência segura.

2. **Alta — proteção contra duplicatas cobre o evento, não a compra.** `PurchaseListener.kt:20` usa pacote, chave Android e horário. Reentrega com a mesma identidade é protegida; outra chave/horário para a mesma compra produz outro identificador. O sistema também não compara com lançamentos manuais. Há risco condicional de duplicação; não foi reproduzido no aparelho. Comparações por valor/loja/horário devem sugerir revisão, pois duas compras legítimas podem coincidir.

3. **Alta — apagar dados e importar não compartilham uma barreira de execução.** `hooks/useStore.ts:653` limpa o armazenamento fora da fila financeira; somente ao final emite um evento (`:697`). O provider agenda a limpeza em sua própria fila e o emissor não aguarda sua conclusão (`context/PurchaseImportContext.tsx:65`). Uma importação concorrente pode gravar depois da remoção ou atravessar o reinício do estado. Necessário suspender processamento e aguardar gravações antes da limpeza; confirmar em teste de concorrência.

4. **Média — risco de lentidão com uso prolongado.** `handled` e `pending` não têm retenção/limite no armazenamento JavaScript. A busca por identificador percorre arrays; cada captura regrava o objeto completo. A lista de pendências usa `map` dentro de ScrollView (`app/notification-import.tsx:57`), montando todos os itens. Crescimento e custo são confirmados por inspeção; impacto no S23 ainda não foi medido. Usar índices, armazenamento incremental, retenção que preserve a deduplicação e lista virtualizada/paginada.

5. **Média — configurações podem divergir após falha.** `saveBanks` persiste a regra antes de atualizar a lista nativa (`context/PurchaseImportContext.tsx:70`). Se a segunda etapa falhar, a interface mantém o novo estado enquanto a captura pode continuar com a configuração anterior. Não há reconciliação automática ao iniciar. Implementar aplicação recuperável/reconciliação e teste de falha, inclusive ao desativar.

6. **Melhoria funcional — reconhecimento e revisão ainda limitados.** O parser exige a palavra `compra`; mensagem sintética `Pagamento aprovado no credito R$ 45,90` foi ignorada. Isso evita interpretar pagamentos indevidamente, mas exige regras verificadas com textos reais de cada banco. Parcelas exigem sair para o formulário completo e descartar a sugestão; não há importação guiada de parcelas. Regras são por aplicativo/modalidade, sem múltiplos destinos por cartão. Não ampliar reconhecimento por palavras genéricas sem validação de exemplos positivos e negativos.

## Pendência de validação

O Kotlin não foi compilado nem executado no S23 nesta revisão. É preciso validar APK, concessão/revogação de acesso, reinício, captura com app fechado e mensagens reais antes de considerar a função pronta para uso automático. App fechado apenas acumula capturas; lançamentos são processados ao reabrir, conforme o comportamento documentado.

## Evidências

- 17 testes existentes aprovados em três suítes: parser, provider e tela de importação.
- Experimentos em memória com o parser real confirmaram elegibilidade de compra com final não conferido e descarte de mensagem sem a palavra compra. Dados inteiramente sintéticos.
- Os testes existentes não cobrem as falhas de concorrência, divergência de configurações nem identidades distintas para a mesma compra.
- Não foram medidos desempenho ou comportamento nativo. Achados de risco estão separados de comportamentos reproduzidos.
