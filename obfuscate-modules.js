const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const modulesDir = './modules';
const files = fs.readdirSync(modulesDir)
    .filter(f => f.endsWith('.js') && !f.endsWith('.min.js'));

console.log(`🚀 Начинаем обфускацию ${files.length} файлов...`);

files.forEach(file => {
    const inputPath = path.join(modulesDir, file);
    const outputPath = path.join(modulesDir, file.replace('.js', '.min.js'));
    
    console.log(`📦 ${file} -> ${file.replace('.js', '.min.js')}`);
    
    try {
        // Используем javascript-obfuscator с настройками
        const cmd = `javascript-obfuscator ${inputPath} --output ${outputPath} --compact true --string-array true --string-array-encoding rc4 --self-defending false`;
        execSync(cmd, { stdio: 'inherit' });
        console.log(`✅ ${file} обфусцирован`);
    } catch (error) {
        console.error(`❌ Ошибка при обфускации ${file}:`, error.message);
    }
});

console.log('🎉 Обфускация модулей завершена!');