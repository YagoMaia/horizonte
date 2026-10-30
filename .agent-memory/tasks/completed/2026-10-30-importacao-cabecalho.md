# Atalho de importação ao lado de Horizonte

- Status: concluída em 30/10/2026.
- Solicitação: colocar o botão de importação ao lado do acesso ao Horizonte.
- Resultado: botão Importar com ícone no cabeçalho principal, imediatamente após Horizonte; removido o atalho interno de Saldos e sua propriedade de navegação. Grupo permite quebra de linha em telas estreitas/fontes ampliadas e tem área mínima de toque de 48.
- Verificação: TypeScript aprovado; testes existentes de Saldos executados; diff sem erros.
- Arquivos: app/index.tsx, components/screens/SaldosScreen.tsx; instruções de acesso atualizadas.
