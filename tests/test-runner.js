// tests/test-runner.js
const { TestLogger } = require('./logger.js');

class TestRunner {
    constructor(options = {}) {
        this.logger = options.logger || new TestLogger(options);
        this.tests = [];
        this.results = [];
        this.passed = 0;
        this.failed = 0;
        this.skipped = 0;
        this.startTime = null;
        this.endTime = null;
        this.currentTest = null;
    }

    test(name, fn) {
        this.tests.push({ name, fn, skip: false });
        return this;
    }

    skip(name, fn) {
        this.tests.push({ name, fn, skip: true });
        return this;
    }

    async run() {
        this.startTime = Date.now();
        this.logger.start();
        this.logger.section('🚀 ЗАПУСК ТЕСТОВ');

        for (const test of this.tests) {
            await this.runTest(test);
        }

        this.endTime = Date.now();
        this.logger.section('📊 ИТОГОВЫЕ РЕЗУЛЬТАТЫ');
        this.logger.info(`✅ Пройдено: ${this.passed}`);
        this.logger.info(`❌ Провалено: ${this.failed}`);
        this.logger.info(`⏭️ Пропущено: ${this.skipped}`);
        this.logger.info(`📋 Всего: ${this.tests.length}`);
        this.logger.info(`⏱️ Время: ${this.endTime - this.startTime}ms`);

        if (this.failed > 0) {
            this.logger.error('❌ Проваленные тесты:');
            for (const result of this.results) {
                if (result.status === 'failed') {
                    this.logger.error(`  - ${result.name}: ${result.error?.message || 'Unknown error'}`);
                }
            }
        }

        this.logger.end();
        return { passed: this.passed, failed: this.failed, skipped: this.skipped, results: this.results };
    }

    async runTest(test) {
        if (test.skip) {
            this.skipped++;
            this.logger.warn(`⏭️ ПРОПУЩЕН: ${test.name}`);
            this.results.push({ name: test.name, status: 'skipped' });
            return;
        }

        this.currentTest = test;
        this.logger.subsection(`🧪 ${test.name}`);
        
        const start = Date.now();
        try {
            const context = this.createTestContext(test);
            await test.fn(context);
            const duration = Date.now() - start;
            this.passed++;
            this.logger.success(`✅ ПРОЙДЕН: ${test.name} (${duration}ms)`);
            this.results.push({ name: test.name, status: 'passed', duration });
        } catch (error) {
            const duration = Date.now() - start;
            this.failed++;
            this.logger.error(`❌ ПРОВАЛЕН: ${test.name} (${duration}ms)`);
            this.logger.error(`   Ошибка: ${error.message}`);
            if (error.stack) {
                const stackLines = error.stack.split('\n').slice(0, 3);
                this.logger.error(`   Stack: ${stackLines.join('\n   ')}`);
            }
            this.results.push({ name: test.name, status: 'failed', duration, error });
        }
        this.currentTest = null;
    }

    createTestContext(test) {
        return {
            name: test.name,
            assert: (condition, message) => {
                if (!condition) {
                    throw new Error(message || 'Assertion failed');
                }
                return true;
            },
            expect: (actual) => {
                return new TestExpectation(actual, this.logger);
            },
            log: (level, message, data) => {
                this.logger.log(level, `[${test.name}] ${message}`, data);
            },
            logger: this.logger
        };
    }
}

// tests/test-runner.js - добавляем методы в класс TestExpectation

class TestExpectation {
    constructor(actual, logger) {
        this.actual = actual;
        this.logger = logger;
        this._not = false;
        this._callCount = 0;
    }

    get not() {
        this._not = true;
        return this;
    }

    toBe(expected) {
        const passed = this.actual === expected;
        const result = this._not ? !passed : passed;
        if (!result) {
            throw new Error(`Expected ${this._not ? 'not ' : ''}${expected}, got ${this.actual}`);
        }
        return result;
    }

    toEqual(expected) {
        const passed = JSON.stringify(this.actual) === JSON.stringify(expected);
        const result = this._not ? !passed : passed;
        if (!result) {
            throw new Error(`Expected ${this._not ? 'not ' : ''}${JSON.stringify(expected)}, got ${JSON.stringify(this.actual)}`);
        }
        return result;
    }

    toBeDefined() {
        const passed = this.actual !== undefined && this.actual !== null;
        const result = this._not ? !passed : passed;
        if (!result) {
            throw new Error(`Expected ${this._not ? 'not ' : ''}defined, got ${this.actual}`);
        }
        return result;
    }

    toBeTruthy() {
        const passed = !!this.actual;
        const result = this._not ? !passed : passed;
        if (!result) {
            throw new Error(`Expected ${this._not ? 'not ' : ''}truthy, got ${this.actual}`);
        }
        return result;
    }

    toBeFalsy() {
        const passed = !this.actual;
        const result = this._not ? !passed : passed;
        if (!result) {
            throw new Error(`Expected ${this._not ? 'not ' : ''}falsy, got ${this.actual}`);
        }
        return result;
    }

    toContain(expected) {
        const passed = this.actual && this.actual.includes(expected);
        const result = this._not ? !passed : passed;
        if (!result) {
            throw new Error(`Expected ${this._not ? 'not ' : ''}${this.actual} to contain ${expected}`);
        }
        return result;
    }

    toHaveLength(expected) {
        const passed = this.actual && this.actual.length === expected;
        const result = this._not ? !passed : passed;
        if (!result) {
            throw new Error(`Expected ${this._not ? 'not ' : ''}length ${expected}, got ${this.actual?.length}`);
        }
        return result;
    }

    toBeType(type) {
        const passed = typeof this.actual === type;
        const result = this._not ? !passed : passed;
        if (!result) {
            throw new Error(`Expected ${this._not ? 'not ' : ''}type ${type}, got ${typeof this.actual}`);
        }
        return result;
    }

    toBeGreaterThan(expected) {
        const passed = this.actual > expected;
        const result = this._not ? !passed : passed;
        if (!result) {
            throw new Error(`Expected ${this._not ? 'not ' : ''}${this.actual} to be greater than ${expected}`);
        }
        return result;
    }

    toBeLessThan(expected) {
        const passed = this.actual < expected;
        const result = this._not ? !passed : passed;
        if (!result) {
            throw new Error(`Expected ${this._not ? 'not ' : ''}${this.actual} to be less than ${expected}`);
        }
        return result;
    }

    // ⭐ НОВЫЙ МЕТОД - toBeGreaterThanOrEqual
    toBeGreaterThanOrEqual(expected) {
        const passed = this.actual >= expected;
        const result = this._not ? !passed : passed;
        if (!result) {
            throw new Error(`Expected ${this._not ? 'not ' : ''}${this.actual} to be >= ${expected}`);
        }
        return result;
    }

    // ⭐ НОВЫЙ МЕТОД - toBeLessThanOrEqual
    toBeLessThanOrEqual(expected) {
        const passed = this.actual <= expected;
        const result = this._not ? !passed : passed;
        if (!result) {
            throw new Error(`Expected ${this._not ? 'not ' : ''}${this.actual} to be <= ${expected}`);
        }
        return result;
    }

    toBeCloseTo(expected, precision = 5) {
        const diff = Math.abs(this.actual - expected);
        const passed = diff < Math.pow(10, -precision);
        const result = this._not ? !passed : passed;
        if (!result) {
            throw new Error(`Expected ${this._not ? 'not ' : ''}${this.actual} to be close to ${expected} (precision: ${precision})`);
        }
        return result;
    }

    toHaveProperty(prop) {
        const passed = this.actual && this.actual[prop] !== undefined;
        const result = this._not ? !passed : passed;
        if (!result) {
            throw new Error(`Expected ${this._not ? 'not ' : ''}property ${prop} to exist`);
        }
        return result;
    }

    toMatch(pattern) {
        const passed = pattern.test(this.actual);
        const result = this._not ? !passed : passed;
        if (!result) {
            throw new Error(`Expected ${this._not ? 'not ' : ''}${this.actual} to match ${pattern}`);
        }
        return result;
    }
}

module.exports = { TestRunner, TestExpectation };