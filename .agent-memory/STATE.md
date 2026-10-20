Projeto: Horizonte, aplicativo móvel de finanças.
Última tarefa: tasks/completed/2026-10-20-gerar-apk.md
Estado: projeto preparado para gerar APK Android pelo EAS Build.
Entrega anterior: eas.json, app.json, package.json e README.md; perfil preview gera APK e production gera AAB.
Verificações: configuração Expo, TypeScript, git diff --check e 22 suítes/130 testes com backup privado local aprovados.
Decisões: APK é gerado no perfil preview para instalação direta; AAB fica no perfil production para Play Store.
Preferências: Galaxy S23, layout adaptável e áreas seguras. Backup privado fora do repositório e intacto.
Limites: a primeira compilação requer login na conta Expo e criação/uso da chave Android pelo EAS.
Próxima etapa: executar npm run eas:configure e npm run build:apk após login na Expo.
