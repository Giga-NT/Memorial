// obfuscate-all.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Конфигурация для каждого файла
const configs = {
    // Для файлов, которые используются в основном коде
    default: {
        compact: true,
        stringArray: true,
        stringArrayEncoding: 'rc4',
        selfDefending: false,
        deadCodeInjection: false,
        controlFlowFlattening: false,
        renameGlobals: false,
        renameProperties: false,
    },
    // Для furniture3D (сохраняем имена свойств и методов)
    furniture: {
        compact: true,
        stringArray: true,
        stringArrayEncoding: 'base64',
        selfDefending: false,
        deadCodeInjection: false,
        controlFlowFlattening: false,
        renameGlobals: false,
        renameProperties: false,
        // Сохраняем имена методов для корректной работы
        transformObjectKeys: false,
    },
    // Для mobile-improvements (сохраняем имена методов)
    mobile: {
        compact: true,
        stringArray: true,
        stringArrayEncoding: 'base64',
        selfDefending: false,
        deadCodeInjection: false,
        controlFlowFlattening: false,
        renameGlobals: false,
        renameProperties: false,
        transformObjectKeys: false,
    }
};

// Список файлов для обфускации с конфигурацией
const filesToObfuscate = [
    { 
        src: 'performance-optimized.js', 
        dest: 'modules/performance-optimized.min.js',
        config: 'default'
    },
    { 
        src: 'textures-optimized.js', 
        dest: 'modules/textures-optimized.min.js',
        config: 'default'
    },
    { 
        src: 'textures.js', 
        dest: 'modules/textures.min.js',
        config: 'default'
    },
    { 
        src: 'tileManager.js', 
        dest: 'modules/tileManager.min.js',
        config: 'default'
    },
    // ⭐ FURNITURE3D С ОСОБЫМИ НАСТРОЙКАМИ
    { 
        src: 'modules/furniture3D.js', 
        dest: 'modules/furniture3D.min.js',
        config: 'furniture'
    },
    // ⭐ НОВЫЙ ФАЙЛ ДЛЯ МОБИЛЬНЫХ УЛУЧШЕНИЙ
    { 
        src: 'modules/mobile-improvements.js', 
        dest: 'modules/mobile-improvements.min.js',
        config: 'mobile'
    }
];

// Создаём папку modules если её нет
if (!fs.existsSync('./modules')) {
    fs.mkdirSync('./modules');
}

console.log(`🚀 Начинаем обфускацию ${filesToObfuscate.length} файлов...`);

filesToObfuscate.forEach(({ src, dest, config }) => {
    const inputPath = path.join(__dirname, src);
    const outputPath = path.join(__dirname, dest);
    
    if (!fs.existsSync(inputPath)) {
        console.log(`❌ Файл не найден: ${src}`);
        return;
    }
    
    console.log(`📦 ${src} → ${dest} (конфиг: ${config})`);
    
    try {
        const cfg = configs[config] || configs.default;
        
        // Собираем аргументы командной строки
        let args = [
            `--compact ${cfg.compact}`,
            `--string-array ${cfg.stringArray}`,
            `--string-array-encoding ${cfg.stringArrayEncoding}`,
            `--self-defending ${cfg.selfDefending}`,
            `--dead-code-injection ${cfg.deadCodeInjection}`,
            `--control-flow-flattening ${cfg.controlFlowFlattening}`,
            `--rename-globals ${cfg.renameGlobals}`,
            `--rename-properties ${cfg.renameProperties}`,
        ];
        
        // Дополнительные настройки для furniture и mobile
        if (cfg.transformObjectKeys !== undefined) {
            args.push(`--transform-object-keys ${cfg.transformObjectKeys}`);
        }
        
        const cmd = `javascript-obfuscator ${inputPath} --output ${outputPath} ${args.join(' ')}`;
        execSync(cmd, { stdio: 'inherit' });
        console.log(`✅ ${src} обфусцирован`);
    } catch (error) {
        console.error(`❌ Ошибка при обфускации ${src}:`, error.message);
    }
});

console.log('🎉 Обфускация завершена!');