# Correções da importação — 29/10/2026

Todos os seis achados da revisão receberam mudanças de código:

1. Associação de múltiplos cartões/contas por final dentro do mesmo aplicativo e modalidade. Finais desconhecidos exigem revisão. Sem final, destino padrão automático depende de autorização explícita.
2. Conferência de despesas semelhantes dentro da gravação financeira, incluindo lançamentos manuais, notificações com IDs diferentes, eventos simultâneos e total de compras parceladas. Uma possível duplicata requer confirmação explícita de que se trata de outra compra. Identidade nativa inclui conteúdo para não perder alterações que reutilizam chave e horário.
3. Limpeza com barreira entre captura/importação e fila financeira; aguarda gravações, desativa a captura e mantém marca persistente de limpeza interrompida. Uma falha mantém importações pausadas; a limpeza pode ser repetida com segurança.
4. Lotes de 25 capturas, agrupamento de verificações concorrentes, limite de 200 pendências com excesso retido na fila nativa, índice de 4000 IDs e corpos gravados individualmente. Compactação restringe capturas antigas à revisão para preservar segurança contra duplicação. Paginação de 20 itens. Legados são migrados sem descartar pendências.
5. Captura desativada antes de salvar regras, recuperação conforme configuração durável e reconciliação ao atualizar/abrir. Confirmação nativa de escrita; evita regravar pacotes inalterados em cada varredura.
6. Reconhecimento conservador de avisos de pagamento no cartão para revisão; exclusão de faturas/PIX/boletos/transferências/recusas/estornos. Revisão integrada de parcelas com escolha obrigatória de valor total ou unitário, total exibido e gravação pelo mecanismo financeiro existente.

## Validação

TypeScript aprovado. Suíte geral com 27 suítes/191 testes aprovados; quatro testes privados ignorados por backup indisponível. O recorte específico passou com 57 testes em seis suítes. Foram cobertos destinos, mensagens ambíguas, falhas de gravação/aplicação de regras, histórico limitado/migração, paginação, parcelas, duplicatas simultâneas e limpeza integrada dos providers com persistência simulada. Compilação Kotlin do módulo Android aprovada com Java 17 localizado no cache do Gradle. Integridade do diff aprovada.

A compatibilidade com mensagens reais dos bancos e o comportamento no S23 exigem validação no aparelho. O processamento com o app fechado continua sendo posterior, ao reabrir. Esta correção não cria execução permanente do JavaScript.

O processamento do manifesto principal Android também passou. O serviço de captura integra a configuração final da aplicação; isso ainda não equivale a gerar/instalar um APK completo.
