const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const appJsonPath = path.join(__dirname, '../app.json');
const pkgJsonPath = path.join(__dirname, '../package.json');

console.log('1. Atualizando versões...');

// Ler arquivos
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

// Bump patch version (ex: 1.0.1 -> 1.0.2)
const oldVersion = appJson.expo.version || pkgJson.version || '1.0.0';
const versionParts = oldVersion.split('.');
versionParts[2] = parseInt(versionParts[2] || 0, 10) + 1;
const newVersion = versionParts.join('.');

// Atualizar version e versionCode no app.json
appJson.expo.version = newVersion;
if (!appJson.expo.android) appJson.expo.android = {};
const oldVersionCode = appJson.expo.android.versionCode || 1;
const newVersionCode = oldVersionCode + 1;
appJson.expo.android.versionCode = newVersionCode;

// Atualizar package.json
pkgJson.version = newVersion;

// Salvar
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');

console.log(`✅ Versão atualizada: ${oldVersion} -> ${newVersion} (versionCode: ${newVersionCode})`);

try {
  console.log('\n2. Iniciando prebuild (Expo)...');
  execSync('npx expo prebuild -p android', { stdio: 'inherit' });

  console.log('\n3. Iniciando build nativo (Android assembleRelease)...');
  const gradlewCmd = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  execSync(`${gradlewCmd} assembleRelease`, { cwd: path.join(__dirname, '../android'), stdio: 'inherit' });

  console.log('\n4. Copiando APK para a raiz do projeto...');
  const apkSource = path.join(__dirname, '../android/app/build/outputs/apk/release/app-release.apk');
  const apkDest = path.join(__dirname, `../Horizonte-v${newVersion}.apk`);

  if (fs.existsSync(apkSource)) {
      fs.copyFileSync(apkSource, apkDest);
      console.log(`\n🎉 SUCESSO! APK copiado para: ${apkDest}`);
  } else {
      console.error(`\n❌ ERRO: APK não encontrado no diretório esperado: ${apkSource}`);
      process.exit(1);
  }
} catch (error) {
  console.error('\n❌ ERRO durante o processo de build:', error.message);
  process.exit(1);
}
