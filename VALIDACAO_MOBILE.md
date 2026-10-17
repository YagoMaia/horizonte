# Validação móvel com backup local — 17/10/2026

Referência do usuário: Galaxy S23. A adaptação considera largura lógica e escala de fonte, sem fixar a interface a esse modelo.

## Base utilizada

Backup legado 1.0 fornecido pelo usuário: 6 contas, 638 lançamentos e 10 etiquetas. Não contém projetos, metas nem todas as preferências da versão atual; campos ausentes recebem os padrões previstos na migração. O arquivo original não foi alterado nem incorporado ao repositório.

Testes opt-in em `__tests__/localBackup.test.ts` verificam restauração/reexportação, preservação de contas e lançamentos, saldos por conta contra um cálculo independente, partição por mês, projeções finitas e abertura pelo store sem alterar lançamentos ou baixar pendências. Armazenamento simulado, sem conexão com banco ou dinheiro real.

## Ajustes

- Lançamentos: descrição em até duas linhas; valor e confirmação em linha própria quando a largura útil, considerando a fonte, é pequena.
- Resumo: uma coluna em largura reduzida ou fonte ampliada, mantendo duas quando há espaço.
- Filtros: margem inferior considera a área segura de gestos do Android.
- Estrutura principal: respeita áreas seguras laterais; cabeçalho permite quebra; abas têm área mínima de toque e rótulos ajustáveis.
- Apresentação inicial: conteúdo rolável, ilustração menor em telas baixas, botão com altura flexível e recálculo da página após mudança de largura.

## Evidências e limites

Rodada final: **53 testes aprovados em oito suítes**, TypeScript sem erros e verificação de whitespace aprovada.

Inspeção web com a base real em 320×640, 360×780, 412×915 e 780×360. Filtros aplicados e botões acessíveis por rolagem, inclusive na horizontal. Na largura 360, 16 elementos monetários renderizados apresentaram zero transbordamento horizontal na medição de conteúdo. Captura com valores ocultos: `.agent-memory/saldos-mobile-360.png`.

Testes de componente cobrem larguras 320, 360, 412, 780 e escala de fonte 2, com descrição e valor sintéticos longos, confirmação e cancelamento dos filtros. Esses testes não medem posicionamento nativo de pixels.

O carregador temporário de dados foi removido e o servidor local encerrado após a inspeção. Testes futuros usam a variável de ambiente, sem arquivo privado no código.

Não houve instalação ou execução no S23 físico. Fonte do Android, teclado, gestos e fluidez nativa ainda exigem conferência no aparelho. A inspeção visual focou Saldos e filtros; os ajustes compartilhados e de apresentação foram verificados por TypeScript e suíte automatizada, sem afirmar auditoria visual completa de todas as telas.
