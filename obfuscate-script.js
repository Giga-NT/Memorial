const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Начинаем обфускацию основного скрипта...');

const inputFile = './script.js';
const outputFile = './script.min.js';

try {
    console.log(`📦 ${inputFile} -> ${outputFile}`);
    
    // Обфусцируем с настройками
    const cmd = `npx javascript-obfuscator ${inputFile} --output ${outputFile} --compact true --string-array true --string-array-encoding rc4 --self-defending false --rename-globals false`;
    execSync(cmd, { stdio: 'inherit' });
    
    console.log(`✅ Основной скрипт обфусцирован: ${outputFile}`);
    
    // Проверяем, что файл создался
    if (fs.existsSync(outputFile)) {
        const stats = fs.statSync(outputFile);
        console.log(`📊 Размер файла: ${(stats.size / 1024).toFixed(2)} KB`);
        console.log('🎉 Обфускация завершена!');
    } else {
        console.error('❌ Файл не создан!');
    }
    
} catch (error) {
    console.error('❌ Ошибка при обфускации:', error.message);
}