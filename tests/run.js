// tests/run.js
const path = require('path');
const { TestLogger } = require('./logger.js');
const { TestRunner } = require('./test-runner.js');
const { createFullAppTests } = require('./app-tests-full.js');

// Проверяем аргументы командной строки
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const logDir = args.find(arg => arg.startsWith('--log-dir='))?.split('=')[1] || './logs';

// Создаем логгер и раннер
const logger = new TestLogger({
    testName: 'MultiMonumentManager Full Test Suite',
    logDir: path.join(process.cwd(), logDir),
    verbose: verbose,
    colors: true,
    enabled: true
});

const runner = new TestRunner({ logger });

// Регистрируем все тесты
createFullAppTests(runner);

// Запускаем тесты
async function main() {
    try {
        logger.section('🚀 ЗАПУСК ТЕСТОВОГО СЮИТА');
        const results = await runner.run();
        
        const exitCode = results.failed > 0 ? 1 : 0;
        process.exit(exitCode);
    } catch (error) {
        logger.error('❌ Критическая ошибка при выполнении тестов', {
            message: error.message,
            stack: error.stack
        });
        logger.end();
        process.exit(1);
    }
}

main();