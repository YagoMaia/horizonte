# Cabeçalho compacto no celular

- Status: concluída em 30/10/2026.
- Solicitação: impedir que atalhos Horizonte/Importar fiquem abaixo do título no S23.
- Resultado: cabeçalho em uma linha; atalhos apenas com ícones quando largura/escala de fonte é inferior a 440. Em telas maiores, mantém rótulos. Título pode se ajustar dentro de sua área; ações não quebram para a linha inferior.
- Acessibilidade: áreas de toque de 48, rótulos dos ícones e escala de fonte preservados.
- Validação: TypeScript e diff aprovados; sem nova validação física no S23.
- Arquivo: app/index.tsx.
