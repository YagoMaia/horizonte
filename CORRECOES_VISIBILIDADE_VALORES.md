# Remoção dos controles de ocultação — 27/10/2026

- Removidos os botões Ocultar valores/Mostrar valores de Saldos, Totais, Horizonte e Cartões.
- Removidos estado compartilhado, campos de estado de navegação e propriedades de ocultação em resumos, gráficos, lançamentos e detalhes.
- Valores são sempre exibidos, inclusive nas descrições de acessibilidade; estados antigos de ocultação deixam de ser lidos.
- Validação: TypeScript e git diff --check aprovados. 21 suítes com 133 testes aprovados.
- Quatro testes opt-in do backup privado não puderam executar: arquivo ausente no caminho anteriormente informado. Nenhum arquivo de backup foi modificado.
- Sem validação física no S23 nesta etapa.
