'use strict';

// Browser-level regression suite. Start the app separately with `npm start`.
// Usage: npm run test:e2e
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const OUT_DIR = path.join(process.cwd(), 'test-logs', 'e2e');
const FIXTURE = path.join(__dirname, 'fixtures', 'test-photo.svg');
const results = [];
let browser;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function record(name, status, details = '') {
    results.push({ name, status, details });
    const icon = status === 'passed' ? 'PASS' : status === 'failed' ? 'FAIL' : 'SKIP';
    console.log(`[${icon}] ${name}${details ? ' — ' + details : ''}`);
}

async function test(name, fn) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') errors.push('console: ' + message.text());
    });
    try {
        await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await page.waitForSelector('#canvas-container canvas', { visible: true, timeout: 30000 });
        await fn(page, errors);
        if (errors.length) throw new Error(errors.join('\n'));
        record(name, 'passed');
    } catch (error) {
        const file = path.join(OUT_DIR, name.replace(/[^a-z0-9а-я_-]+/gi, '_') + '.png');
        try { await page.screenshot({ path: file, fullPage: true }); } catch (_) {}
        record(name, 'failed', error.message + ` (screenshot: ${file})`);
    } finally {
        await page.close();
    }
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    browser = await puppeteer.launch({
        headless: process.env.HEADED !== '1',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--enable-webgl']
    });

    await test('Старт приложения и 3D-сцена', async page => {
        const state = await page.evaluate(() => ({
            title: document.title,
            canvasCount: document.querySelectorAll('canvas').length,
            canvasSize: [...document.querySelectorAll('canvas')].map(c => [c.width, c.height]),
            bodyText: document.body.innerText
        }));
        if (!state.title.includes('Конструктор')) throw new Error('Не найден заголовок приложения');
        if (!state.canvasCount || state.canvasSize.every(([w,h]) => !w || !h)) throw new Error('3D canvas отсутствует или имеет нулевой размер');
    });

    await test('ФИО и даты', async page => {
        for (const [selector, value] of [['#fullName', 'Тестов Иван Иванович'], ['#datesText', '02.02.1950 — 03.03.2026']]) {
            const input = await page.$(selector);
            if (!input) throw new Error('Не найдено поле ' + selector);
            await page.$eval(selector, (el, v) => {
                el.value = v;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }, value);
            const actual = await page.$eval(selector, el => el.value);
            if (actual !== value) throw new Error(selector + ': значение не сохранилось');
        }
    });

    await test('Чекбоксы конфигурации и разделов', async page => {
        const selectors = [
            '[data-module-toggle]', '#pedestalEnabled', '#baseEnabled', '#flowerEnabled',
            '#pathEnabled', '#fenceEnabled', '#fenceGateEnabled', '#curbVisible',
            '#curbGateOpeningEnabled', '#curbInstallEnabled', '#enableDragText',
            '#enableDragEpitaph', '#enableMovePhoto', '#showFurniture', '#showVases',
            '#includeDuplicatorsInPrice', '#includeInstall', '#showPricePanel'
        ];
        const report = await page.evaluate(selectors => {
            const missing = selectors.filter(s => !document.querySelector(s));
            const changed = [];
            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (!el) continue;
                const before = el.checked;
                el.checked = !before;
                el.dispatchEvent(new Event('change', { bubbles: true }));
                changed.push({ selector, before, after: el.checked });
                el.checked = before;
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
            return { missing, changed };
        }, selectors);
        if (report.missing.length) throw new Error('Не найдены чекбоксы: ' + report.missing.join(', '));
        if (report.changed.length !== selectors.length) throw new Error('Не все чекбоксы обработаны');
    });

    await test('Ползунки и синхронизация числовых полей', async page => {
        const ranges = await page.$$eval('input[type="range"]', els => els.map(el => ({
            id: el.id, min: el.min, max: el.max, value: el.value
        })));
        if (ranges.length < 10) throw new Error('Найдено подозрительно мало ползунков: ' + ranges.length);
        const failed = await page.evaluate(() => {
            const failures = [];
            for (const el of document.querySelectorAll('input[type="range"]')) {
                const oldValue = Number(el.value);
                const min = el.min === '' ? 0 : Number(el.min);
                const max = el.max === '' ? 100 : Number(el.max);
                const step = el.step && el.step !== 'any' ? Number(el.step) : 1;
                const rawTarget = min + (max - min) * 0.63;
                const target = Math.min(max, Math.max(min,
                    min + Math.round((rawTarget - min) / step) * step));
                el.value = String(target);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                const applied = Number(el.value);
                const tolerance = Math.max(1e-7, Math.abs(step) * 1e-5);
                if (!Number.isFinite(applied) || Math.abs(applied - target) > tolerance) {
                    failures.push(el.id || '(range without id)');
                }
                const pairedNumber = el.id ? document.getElementById(el.id + 'Input') : null;
                if (pairedNumber && Math.abs(Number(pairedNumber.value) - applied) > tolerance) {
                    failures.push((el.id || '(range)') + ' ↔ ' + pairedNumber.id);
                }
                el.value = String(oldValue);
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
            return failures;
        });
        if (failed.length) throw new Error('Не применились значения ползунков или связанных числовых полей: ' + failed.join(', '));
    });

    await test('Загрузка фотографии', async page => {
        const input = await page.$('#textureUpload');
        if (!input) throw new Error('Не найден input #textureUpload');
        await input.uploadFile(FIXTURE);
        await sleep(500);
        const value = await page.$eval('#textureUpload', el => el.files && el.files[0] && el.files[0].name);
        if (value !== 'test-photo.svg') throw new Error('Файл фотографии не выбран');
    });

    await test('Добавление предметов мебели и ваз', async page => {
        const ids = ['#addTableBtn', '#addBenchBtn', '#addPicnicSetBtn', '#addTableGardenBtn', '#addVaseBtn'];
        const missing = await page.evaluate(ids => ids.filter(id => !document.querySelector(id)), ids);
        if (missing.length) throw new Error('Не найдены кнопки добавления: ' + missing.join(', '));
        for (const id of ids) {
            await page.$eval(id, el => el.click());
            await sleep(250);
        }
    });

    await test('Инструменты перемещения и поворота', async page => {
        const ids = ['#moveModeBtn', '#rotateModeBtn', '#rotateLeftBtn', '#rotateRightBtn', '#rotateResetBtn', '#deleteSelectedBtn'];
        const missing = await page.evaluate(ids => ids.filter(id => !document.querySelector(id)), ids);
        if (missing.length) throw new Error('Не найдены инструменты: ' + missing.join(', '));
        // Проверяем доступность действий. Удаление запускается только при отсутствии выделенного объекта.
        for (const id of ids.slice(0, 5)) await page.$eval(id, el => el.click());
    });

    await test('Гравировки и элементы эпитафии доступны', async page => {
        const ids = ['#addEngravingFrontBtn', '#addEngravingBackBtn', '#addExtraEpitaphBtn', '#epitaphFontSize', '#nameFontSize', '#datesFontSize'];
        const missing = await page.evaluate(ids => ids.filter(id => !document.querySelector(id)), ids);
        if (missing.length) throw new Error('Не найдены элементы: ' + missing.join(', '));
        await page.$eval('#addEngravingFrontBtn', el => el.click());
        await page.$eval('#addExtraEpitaphBtn', el => el.click());
    });

    await test('Перетаскивание мышью по 3D canvas', async page => {
        const canvas = await page.$('#canvas-container canvas');
        const box = await canvas.boundingBox();
        if (!box || box.width < 100 || box.height < 100) throw new Error('Canvas недоступен для взаимодействия');
        const x = box.x + box.width * 0.5, y = box.y + box.height * 0.5;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 70, y + 35, { steps: 8 });
        await page.mouse.up();
        await sleep(300);
    });

    await test('Кнопки освещения и расчёта стоимости', async page => {
        const before = await page.$eval('#lightingModeBtn', el => el.getAttribute('aria-pressed'));
        await page.click('#lightingModeBtn');
        const after = await page.$eval('#lightingModeBtn', el => el.getAttribute('aria-pressed'));
        if (before === after) throw new Error('Переключатель освещения не изменил состояние');
        await page.click('#refreshPriceBtn');
        await page.waitForTimeout(300);
        const price = await page.$eval('#totalPriceDisplay', el => el.textContent.trim());
        if (!price) throw new Error('Не отображается стоимость');
    });

    await browser.close();
    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const report = { baseUrl: BASE_URL, timestamp: new Date().toISOString(), passed, failed, total: results.length, results };
    fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`\nИТОГО: ${passed} пройдено, ${failed} ошибок из ${results.length}. Отчёт: ${path.join(OUT_DIR, 'report.json')}\n`);
    process.exitCode = failed ? 1 : 0;
}

main().catch(async error => {
    console.error(error);
    if (browser) await browser.close();
    process.exit(1);
});
