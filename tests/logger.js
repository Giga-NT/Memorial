// tests/logger.js
const fs = require('fs');
const path = require('path');

class TestLogger {
    constructor(options = {}) {
        this.logs = [];
        this.startTime = null;
        this.endTime = null;
        this.testName = options.testName || 'unknown';
        this.logDir = options.logDir || path.join(process.cwd(), 'logs');
        this.verbose = options.verbose !== false;
        this.colors = options.colors !== false;
        
        // Создаем папку для логов
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
        
        this.colorsMap = {
            'debug': '\x1b[90m',    // Gray
            'info': '\x1b[36m',     // Cyan
            'warn': '\x1b[33m',     // Yellow
            'error': '\x1b[31m',    // Red
            'success': '\x1b[32m',  // Green
            'test': '\x1b[35m'      // Magenta
        };
        this.resetColor = '\x1b[0m';
    }

    start() {
        this.startTime = new Date();
        this.logs = [];
        this.info(`🧪 НАЧАЛО ТЕСТИРОВАНИЯ: ${this.testName}`);
        this.info(`📁 Логи будут сохранены в: ${this.logDir}`);
    }

    end() {
        this.endTime = new Date();
        const duration = this.endTime - this.startTime;
        this.info(`✅ ЗАВЕРШЕНИЕ ТЕСТИРОВАНИЯ: ${duration}ms`);
        this.saveToFile();
    }

    log(level, message, data = null) {
        const entry = {
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            message: message,
            data: data,
            elapsed: this.startTime ? Date.now() - this.startTime : 0
        };
        this.logs.push(entry);
        
        if (this.verbose) {
            const color = this.colors ? this.colorsMap[level.toLowerCase()] || '' : '';
            const reset = this.colors ? this.resetColor : '';
            const prefix = `[${entry.timestamp}] [${entry.level}]`;
            console.log(`${color}${prefix} ${message}${reset}`);
            if (data) {
                const dataStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
                console.log(`  📦 Data:`, dataStr);
            }
        }
        
        return entry;
    }

    debug(message, data = null) {
        return this.log('debug', message, data);
    }

    info(message, data = null) {
        return this.log('info', message, data);
    }

    warn(message, data = null) {
        return this.log('warn', message, data);
    }

    error(message, data = null) {
        return this.log('error', message, data);
    }

    success(message, data = null) {
        return this.log('success', message, data);
    }

    test(message, data = null) {
        return this.log('test', message, data);
    }

    section(title) {
        const line = '═'.repeat(60);
        this.info(`\n${line}`);
        this.info(`📌 ${title}`);
        this.info(line);
    }

    subsection(title) {
        const line = '─'.repeat(50);
        this.info(`\n📋 ${title}`);
        this.info(line);
    }

    getLogFileName() {
        const date = new Date();
        const timestamp = 
            date.getFullYear() + '-' +
            String(date.getMonth() + 1).padStart(2, '0') + '-' +
            String(date.getDate()).padStart(2, '0') + '-' +
            String(date.getHours()).padStart(2, '0') + '-' +
            String(date.getMinutes()).padStart(2, '0') + '-' +
            String(date.getSeconds()).padStart(2, '0');
        return path.join(this.logDir, `test-${timestamp}.log`);
    }

    saveToFile() {
        try {
            const filePath = this.getLogFileName();
            let content = '='.repeat(80) + '\n';
            content += `🧪 ТЕСТОВЫЙ ЛОГ\n`;
            content += `📋 Тест: ${this.testName}\n`;
            content += `📅 Время начала: ${this.startTime?.toISOString() || 'N/A'}\n`;
            content += `📅 Время окончания: ${this.endTime?.toISOString() || 'N/A'}\n`;
            content += `⏱️ Длительность: ${this.endTime - this.startTime}ms\n`;
            content += `📊 Всего записей: ${this.logs.length}\n`;
            content += '='.repeat(80) + '\n\n';

            // Группируем по уровням
            const levels = {};
            for (const entry of this.logs) {
                if (!levels[entry.level]) levels[entry.level] = [];
                levels[entry.level].push(entry);
            }

            // Выводим статистику по уровням
            content += '📊 СТАТИСТИКА:\n';
            for (const [level, entries] of Object.entries(levels)) {
                content += `  ${level}: ${entries.length}\n`;
            }
            content += '\n' + '='.repeat(80) + '\n\n';

            // Выводим все записи
            for (const entry of this.logs) {
                const emoji = {
                    'DEBUG': '🔍',
                    'INFO': 'ℹ️',
                    'WARN': '⚠️',
                    'ERROR': '❌',
                    'SUCCESS': '✅',
                    'TEST': '🧪'
                };
                content += `${emoji[entry.level] || '•'} [${entry.timestamp}] ${entry.level}: ${entry.message}\n`;
                if (entry.data) {
                    content += `   ${JSON.stringify(entry.data, null, 2)}\n`;
                }
                content += '\n';
            }

            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`\n📁 Лог сохранен: ${filePath}`);
            return filePath;
        } catch (error) {
            console.error('❌ Ошибка сохранения лога:', error);
            return null;
        }
    }

    getLogs() {
        return this.logs;
    }

    clear() {
        this.logs = [];
    }
}

module.exports = { TestLogger };