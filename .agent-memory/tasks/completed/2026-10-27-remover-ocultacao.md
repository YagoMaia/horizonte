# Tarefa: Remover ocultação de valores

- Status: Concluída
- Data: 2026-10-27 BRT
- Objetivo: remover todos os botões de ocultar/mostrar valores e manter valores visíveis.
- Escopo: Saldos, Totais, Horizonte, Cartões, gráficos, detalhes e estado compartilhado.
- Resultado: controles removidos, junto com a lógica e as propriedades de ocultação; estados antigos não são usados. Navegação e cálculos preservados.
- Verificações: TypeScript, git diff --check e 21 suítes/133 testes aprovados. A suíte privada teve quatro falhas de leitura por ausência do arquivo de backup no caminho original; não foram falhas funcionais do aplicativo.
- Limites: backup privado indisponível e sem teste físico no S23 nesta etapa.
- Documento: CORRECOES_VISIBILIDADE_VALORES.md.
