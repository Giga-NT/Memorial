// ============================================
// ЗАГРУЗКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ
// ============================================
require('dotenv').config();

// Проверяем, что критичные переменные загружены
if (!process.env.ADMIN_PASSWORD) {
    console.warn('⚠️ ADMIN_PASSWORD не задан в .env! Используется значение по умолчанию.');
}

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ EMAIL не настроен в .env! Отправка писем не будет работать.');
}

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();

// ============================================
// КОНСТАНТЫ ИЗ .ENV
// ============================================
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';

const EMAIL_USER = process.env.EMAIL_USER || 'gipsogen2008@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'yzhv gyam rbai rune';
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'storage', 'database.db');

// ============================================
// САНИТИЗАЦИЯ ДЛЯ СЕРВЕРА
// ============================================

function sanitizeForServer(str) {
    if (!str) return 'Не указано';
    // Преобразуем в строку
    let result = String(str);
    // Удаляем HTML-теги
    result = result.replace(/<[^>]*>/g, '');
    // Удаляем скрипты
    result = result.replace(/<script[\s\S]*?<\/script>/gi, '');
    // Ограничиваем длину
    result = result.slice(0, 2000);
    // Экранируем опасные символы
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
        '/': '&#x2F;',
        '\\': '&#x5C;',
        '`': '&#x60;'
    };
    return result.replace(/[&<>"'/\\`]/g, function(s) {
        return map[s] || s;
    });
}

// Санитизация объекта
function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return {};
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            sanitized[key] = sanitizeForServer(value);
        } else if (typeof value === 'number') {
            sanitized[key] = isFinite(value) ? value : 0;
        } else if (value === null || value === undefined) {
            sanitized[key] = 'Не указано';
        } else if (Array.isArray(value)) {
            sanitized[key] = value.map(item => {
                if (typeof item === 'string') return sanitizeForServer(item);
                if (typeof item === 'object' && item !== null) return sanitizeObject(item);
                return item;
            });
        } else if (typeof value === 'object') {
            sanitized[key] = sanitizeObject(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

// ============================================
// ОПТИМИЗАЦИЯ - ПАКЕТНАЯ ЗАГРУЗКА
// ============================================

const fileCache = new Map();
const MAX_CACHE_SIZE = 50 * 1024 * 1024;

function cacheFile(filePath) {
    try {
        if (fileCache.has(filePath)) return;
        
        const stat = fs.statSync(filePath);
        if (stat.size > MAX_CACHE_SIZE) return;
        
        const content = fs.readFileSync(filePath);
        fileCache.set(filePath, {
            content,
            size: stat.size,
            mtime: stat.mtimeMs
        });
    } catch (e) {}
}

function preCacheFiles() {
    const dirs = [
        __dirname,
        path.join(__dirname, 'modules'),
        path.join(__dirname, 'textures'),
        path.join(__dirname, 'models')
    ];
    
    dirs.forEach(dir => {
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            files.forEach(file => {
                const ext = path.extname(file).toLowerCase();
                if (['.js', '.css', '.webp', '.png', '.jpg', '.glb', '.json'].includes(ext)) {
                    cacheFile(path.join(dir, file));
                }
            });
        }
    });
}

// ============================================
// MIDDLEWARE
// ============================================

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Слишком много запросов, попробуйте позже'
});
app.use('/api/', limiter);

// Сжатие
app.use(compression({
    level: 6,
    threshold: 1024
}));

// JSON лимит
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// ============================================
// CSP - ПРАВИЛЬНАЯ НАСТРОЙКА
// ============================================

app.use((req, res, next) => {
    // Определяем, это HTML страница или нет
    const isHTML = req.path.endsWith('.html') || req.path === '/' || req.path === '/index.html';
    
    if (isHTML) {
        // Разрешаем загрузку из CDN
        res.setHeader('Content-Security-Policy', [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
            "script-src-elem 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
            "script-src-attr 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "connect-src 'self' ws: wss: blob:",
            "font-src 'self' data: https://cdn.jsdelivr.net",
            "worker-src 'self' blob:",
            "base-uri 'self'"
        ].join('; '));
    } else {
        // Для API и статики - строгий CSP
        res.setHeader('Content-Security-Policy', "default-src 'self'");
    }
    
    // Другие заголовки
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    next();
});

// ============================================
// ОПТИМИЗИРОВАННАЯ РАЗДАЧА СТАТИКИ
// ============================================

// Скачиваем Three.js с CDN и сохраняем локально
async function downloadThreeJS() {
    const modulesDir = path.join(__dirname, 'modules');
    if (!fs.existsSync(modulesDir)) {
        fs.mkdirSync(modulesDir, { recursive: true });
    }
    
    const files = [
        { url: 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', name: 'three.module.js' },
        { url: 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js', name: 'OrbitControls.js' },
        { url: 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js', name: 'GLTFLoader.js' },
        { url: 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/DRACOLoader.js', name: 'DRACOLoader.js' },
        { url: 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/geometries/DecalGeometry.js', name: 'DecalGeometry.js' }
    ];
    
    for (const file of files) {
        const filePath = path.join(modulesDir, file.name);
        if (!fs.existsSync(filePath)) {
            try {
                console.log(`📥 Скачивание ${file.name}...`);
                const response = await fetch(file.url);
                const content = await response.text();
                fs.writeFileSync(filePath, content);
                console.log(`✅ ${file.name} сохранен локально`);
            } catch (e) {
                console.log(`⚠️ Не удалось скачать ${file.name}, будет использоваться CDN`);
            }
        } else {
            console.log(`✅ ${file.name} уже существует локально`);
        }
    }
}

// Запускаем скачивание
downloadThreeJS().catch(console.error);

// Статика с кэшированием
app.use(express.static(__dirname, {
    maxAge: '365d',
    immutable: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
        if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        if (filePath.endsWith('.webp') || filePath.endsWith('.png') || filePath.endsWith('.jpg')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        if (filePath.endsWith('.glb')) {
            res.setHeader('Content-Type', 'model/gltf-binary');
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));

app.use('/models', express.static(path.join(__dirname, 'storage', 'models'), {
    maxAge: '365d',
    immutable: true,
    setHeaders: (res) => {
        res.setHeader('Content-Type', 'model/gltf-binary');
    }
}));

// ============================================
// КАТАЛОГ СТЕЛ
// ============================================

const CATALOG_MODELS_DIR = path.join(__dirname, 'storage', 'models');
const CATALOG_PREVIEWS_DIR = path.join(CATALOG_MODELS_DIR, 'previews');

if (!fs.existsSync(CATALOG_MODELS_DIR)) {
    fs.mkdirSync(CATALOG_MODELS_DIR, { recursive: true });
}

if (!fs.existsSync(CATALOG_PREVIEWS_DIR)) {
    fs.mkdirSync(CATALOG_PREVIEWS_DIR, { recursive: true });
}

app.use('/textures', express.static(path.join(__dirname, 'storage', 'textures'), {
    maxAge: '365d',
    immutable: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.webp')) {
            res.setHeader('Content-Type', 'image/webp');
        }
    }
}));

app.use('/modules', express.static(path.join(__dirname, 'storage', 'modules'), {
    maxAge: '365d',
    immutable: true
}));

app.use('/fonts', express.static(path.join(__dirname, 'storage', 'fonts')));
app.use('/engravings', express.static(path.join(__dirname, 'storage', 'engravings')));


// ============================================
// АДМИНКА
// ============================================

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/downloads/admin_panel', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const time = new Date().toISOString();

    const logEntry = `[${time}] IP: ${ip} | User-Agent: ${userAgent}\n`;
    fs.appendFileSync('hackers.log', logEntry);
    console.log(`🚨 ХАКЕР ПОПАЛСЯ! IP: ${ip}`);

    const forwarded = req.headers['x-forwarded-for'] || 'Не определен';
    const language = req.headers['accept-language'] || 'Не определен';
    const referer = req.headers['referer'] || 'Прямой переход';

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>ACCESS DENIED</title>
<link rel="stylesheet" href="/hacker_style.css">
        </head>
        <body>
            <div class="container">
                <div class="scan-line"></div>
                
                <div class="header">
                    <div class="header-title">⚠️ ВТОРЖЕНИЕ</div>
                    <div class="header-badge">ЗАФИКСИРОВАНО</div>
                </div>
                
                <div class="grid">
                    <div class="card">
                        <div class="card-label">IP-адрес</div>
                        <div class="card-value danger">${ip}</div>
                    </div>
                    <div class="card">
                        <div class="card-label">Время атаки</div>
                        <div class="card-value">${time}</div>
                    </div>
                    <div class="card" style="grid-column: 1 / -1;">
                        <div class="card-label">Операционная система / Браузер</div>
                        <div class="card-value" style="font-size: 13px;">${userAgent}</div>
                    </div>
                    <div class="card">
                        <div class="card-label">Язык системы</div>
                        <div class="card-value success">${language}</div>
                    </div>
                    <div class="card">
                        <div class="card-label">Источник перехода</div>
                        <div class="card-value" style="color: rgba(255,255,255,0.4);">${referer}</div>
                    </div>
                </div>
                
                <div class="footer">
                    ИНЦИДЕНТ ЗАРЕГИСТРИРОВАН В СИСТЕМЕ БЕЗОПАСНОСТИ<br>
                    ВСЕ ДАННЫЕ ПЕРЕДАНЫ АДМИНИСТРАТОРУ<br><br>
                    <strong>Ты оставил след.</strong> <span class="highlight">Удалиться невозможно.</span>
                </div>
            </div>
        </body>
        </html>
    `);
});

// ============================================
// БАЗА ДАННЫХ SQLite + ОДИН ADMIN
// ============================================

let db;

const ALLOWED_PRICE_KEYS = new Set([
    'granite',
    'black_galaxy',
    'ninimyaki',
    'marble',
    'red_granite',
    'beige_granite',
    'gray_granite',

    'base_granite',
    'base_marble',
    'base_red_granite',
    'base_other',

    'grass',
    'gravel',
    'marble_chips',
    'red_gravel',
    'blue_gravel',
    'black_gravel',
    'sand',
    'flowers',
    'moss',

    'pipe',
    'chain',
    'casting',
    'model_3d',
    'venzel',

    'stele_work',
    'engraving',
    'photo',

    'table',
    'bench',
    'picnic_set',

    'delivery',
    'install'
]);


const DEFAULT_PRICES = {
    granite: 5000,
    black_galaxy: 5500,
    ninimyaki: 4500,
    marble: 8000,
    red_granite: 7000,
    beige_granite: 6500,
    gray_granite: 6000,

    base_granite: 4000,
    base_marble: 6000,
    base_red_granite: 5500,
    base_other: 3500,

    grass: 500,
    gravel: 800,
    marble_chips: 1500,
    red_gravel: 1200,
    blue_gravel: 1200,
    black_gravel: 1400,
    sand: 600,
    flowers: 1800,
    moss: 900,

    pipe: 800,
    chain: 600,
    casting: 2000,
    model_3d: 2500,
    venzel: 2200,

    stele_work: 5000,
    engraving: 1500,
    photo: 2000,

    table: 15000,
    bench: 12000,
    picnic_set: 25000,

    delivery: 3000,
    install: 5000
};


const ADMIN_SESSION_DAYS = 7;

let pricesCache = null;
let pricesCacheTime = 0;


// ============================================
// ВСПОМОГАТЕЛЬНЫЕ PROMISE-ФУНКЦИИ
// ============================================

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
                return;
            }

            resolve({
                lastID: this.lastID,
                changes: this.changes
            });
        });
    });
}


function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(row || null);
        });
    });
}


function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(rows || []);
        });
    });
}


// ============================================
// ПАРОЛИ
// ============================================

function hashPassword(password) {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString('hex');

        crypto.scrypt(
            String(password),
            salt,
            64,
            (err, derivedKey) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(
                    `${salt}:${derivedKey.toString('hex')}`
                );
            }
        );
    });
}


function verifyPassword(password, storedHash) {
    return new Promise((resolve) => {
        try {
            if (!storedHash || !storedHash.includes(':')) {
                resolve(false);
                return;
            }

            const [salt, keyHex] = storedHash.split(':');

            crypto.scrypt(
                String(password),
                salt,
                64,
                (err, derivedKey) => {
                    if (err) {
                        resolve(false);
                        return;
                    }

                    const storedKey =
                        Buffer.from(keyHex, 'hex');

                    if (
                        storedKey.length !==
                        derivedKey.length
                    ) {
                        resolve(false);
                        return;
                    }

                    resolve(
                        crypto.timingSafeEqual(
                            storedKey,
                            derivedKey
                        )
                    );
                }
            );

        } catch (error) {
            resolve(false);
        }
    });
}


// ============================================
// ADMIN
// ============================================

function getFirstAdmin() {
    return dbGet(`
        SELECT *
        FROM admins
        ORDER BY id
        LIMIT 1
    `);
}


function getAdminByLogin(login) {
    return dbGet(`
        SELECT *
        FROM admins
        WHERE login = ?
        LIMIT 1
    `, [login]);
}


function getAdminById(id) {
    return dbGet(`
        SELECT
            id,
            login,
            name,
            active,
            created_at
        FROM admins
        WHERE id = ?
        LIMIT 1
    `, [id]);
}


// ============================================
// ГЛОБАЛЬНЫЕ ЦЕНЫ УСТАНОВКИ
// ============================================
//
// ВАЖНО:
// Цены НЕ привязаны к admin_id.
//
// Один клиент / одна установка
// использует одну общую таблицу prices.
//

async function getPrices() {
    const rows = await dbAll(`
        SELECT
            key,
            value
        FROM prices
        ORDER BY key
    `);

    const result = {};

    rows.forEach(row => {
        result[row.key] = Number(row.value);
    });

    return result;
}


async function ensurePrices() {
    let added = 0;

    for (const [key, value] of Object.entries(DEFAULT_PRICES)) {

        const result = await dbRun(`
            INSERT OR IGNORE INTO prices (
                key,
                value
            )
            VALUES (?, ?)
        `, [
            key,
            value
        ]);

        if (result.changes > 0) {
            added++;
        }
    }

    if (added > 0) {
        console.log(
            `💰 Добавлено недостающих цен: ${added}`
        );
    }
}


// ============================================
// МИГРАЦИЯ ТАБЛИЦЫ prices
// ============================================
//
// Поддерживаются:
//
// 1. Старый вариант:
//
// prices
//   id
//   key
//   value
//   updated_at
//
// 2. Текущий временный multi-admin вариант:
//
// prices
//   id
//   admin_id
//   key
//   value
//   updated_at
//
// После запуска будет:
//
// prices
//   id
//   key
//   value
//   updated_at
//
// Если сейчас есть admin_id,
// берём цены первого администратора.
//

async function migratePricesToSingleInstallation() {

    const tableInfo = await dbAll(`
        PRAGMA table_info(prices)
    `);


    // ========================================
    // Таблицы prices вообще нет
    // ========================================

    if (tableInfo.length === 0) {

        await dbRun(`
            CREATE TABLE prices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value INTEGER NOT NULL,
                updated_at TIMESTAMP
                    DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log(
            '✅ Создана таблица prices для установки'
        );

        return;
    }


    // ========================================
    // Проверяем multi-admin структуру
    // ========================================

    const hasAdminId = tableInfo.some(
        column => column.name === 'admin_id'
    );


    if (!hasAdminId) {

        console.log(
            '✅ Таблица prices уже имеет структуру одной установки'
        );

        return;
    }


    // ========================================
    // MULTI-ADMIN -> GLOBAL PRICES
    // ========================================

    console.log(
        '🔄 Обнаружена multi-admin структура prices'
    );

    console.log(
        '🔄 Перенос цен первого администратора в общую таблицу...'
    );


    const firstAdmin = await getFirstAdmin();


    // ========================================
    // Создаём временную таблицу
    // ========================================

    await dbRun(`
        CREATE TABLE prices_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value INTEGER NOT NULL,
            updated_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP
        )
    `);


    // ========================================
    // Переносим цены первого админа
    // ========================================

    if (firstAdmin) {

        const oldRows = await dbAll(`
            SELECT
                key,
                value,
                updated_at
            FROM prices
            WHERE admin_id = ?
            ORDER BY id
        `, [
            firstAdmin.id
        ]);


        for (const row of oldRows) {

            if (!ALLOWED_PRICE_KEYS.has(row.key)) {
                continue;
            }

            await dbRun(`
                INSERT OR IGNORE INTO prices_new (
                    key,
                    value,
                    updated_at
                )
                VALUES (?, ?, ?)
            `, [
                row.key,
                Number(row.value),
                row.updated_at ||
                    new Date().toISOString()
            ]);
        }


        console.log(
            `✅ Перенесено цен: ${oldRows.length}`
        );

    } else {

        console.log(
            '⚠️ Первый администратор не найден, будут использованы стандартные цены'
        );
    }


    // ========================================
    // Заменяем старую таблицу
    // ========================================

    await dbRun(`
        DROP TABLE prices
    `);


    await dbRun(`
        ALTER TABLE prices_new
        RENAME TO prices
    `);


    console.log(
        '✅ Таблица prices переведена на общие цены установки'
    );
}


// ============================================
// СОЗДАНИЕ ПЕРВОГО АДМИНА
// ============================================

async function createInitialAdmin() {

    let admin = await getFirstAdmin();


    if (!admin) {

        console.log(
            `👤 Создание администратора: ${ADMIN_LOGIN}`
        );


        const passwordHash =
            await hashPassword(
                ADMIN_PASSWORD
            );


        const result = await dbRun(`
            INSERT INTO admins (
                login,
                password_hash,
                name,
                active
            )
            VALUES (?, ?, ?, 1)
        `, [
            ADMIN_LOGIN,
            passwordHash,
            ADMIN_LOGIN
        ]);


        admin =
            await getAdminById(
                result.lastID
            );


        console.log(
            `✅ Создан администратор #${result.lastID}: ${ADMIN_LOGIN}`
        );

    } else {

        console.log(
            `👤 Используется администратор: ${admin.login}`
        );
    }


    return admin;
}


// ============================================
// СИНХРОНИЗАЦИЯ ПАРОЛЯ
// ============================================

async function resetAdminPasswordIfRequested() {

    if (
        String(
            process.env.ADMIN_RESET_PASSWORD
        ).toLowerCase() !== 'true'
    ) {
        return;
    }


    const login =
        ADMIN_LOGIN || 'admin';


    const admin =
        await getAdminByLogin(login);


    if (!admin) {

        console.warn(
            `⚠️ Администратор ${login} не найден для сброса пароля`
        );

        return;
    }


    const passwordHash =
        await hashPassword(
            ADMIN_PASSWORD
        );


    await dbRun(`
        UPDATE admins
        SET password_hash = ?
        WHERE id = ?
    `, [
        passwordHash,
        admin.id
    ]);


    console.log(
        `🔐 Пароль администратора ${login} обновлён из .env`
    );
}


// ============================================
// ИНИЦИАЛИЗАЦИЯ БД
// ============================================

async function initDB() {

    db = new sqlite3.Database(
        DB_PATH
    );


    await dbRun(`
        PRAGMA foreign_keys = ON
    `);


    // ========================================
    // ADMINS
    // ========================================

    await dbRun(`
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            login TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT,
            active INTEGER DEFAULT 1,
            created_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP
        )
    `);


    console.log(
        '✅ Таблица admins готова'
    );


    // ========================================
    // ADMIN SESSIONS
    // ========================================

    await dbRun(`
        CREATE TABLE IF NOT EXISTS admin_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token TEXT UNIQUE NOT NULL,
            admin_id INTEGER NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            created_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (admin_id)
                REFERENCES admins(id)
                ON DELETE CASCADE
        )
    `);


    console.log(
        '✅ Таблица admin_sessions готова'
    );


    // ========================================
    // ПЕРВЫЙ / ЕДИНСТВЕННЫЙ АДМИН
    // ========================================

    const firstAdmin =
        await createInitialAdmin();


    // ========================================
    // МИГРАЦИЯ ЦЕН
    // ========================================

    await migratePricesToSingleInstallation();


    // ========================================
    // ДОБАВЛЯЕМ НЕДОСТАЮЩИЕ ЦЕНЫ
    // ========================================

    await ensurePrices();


    // ========================================
    // КАТАЛОГ СТЕЛ
    // ========================================

    await dbRun(`
        CREATE TABLE IF NOT EXISTS steles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            model_id TEXT UNIQUE NOT NULL,

            name TEXT NOT NULL,

            model_file TEXT NOT NULL,

            width REAL NOT NULL DEFAULT 0.6,

            height REAL NOT NULL DEFAULT 1.3,

            depth REAL NOT NULL DEFAULT 0.08,

            model_type TEXT NOT NULL
                DEFAULT 'vertical',

            rotation TEXT
                DEFAULT '',

            active INTEGER NOT NULL
                DEFAULT 1,

            created_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP,

            updated_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP
        )
    `);


    console.log(
        '✅ Таблица steles готова'
    );


    // ========================================
    // ПАРОЛЬ ИЗ .ENV
    // ========================================

    await resetAdminPasswordIfRequested();


    // ========================================
    // ОЧИСТКА СТАРЫХ СЕССИЙ
    // ========================================

    await dbRun(`
        DELETE FROM admin_sessions
        WHERE expires_at < datetime('now')
    `);


    console.log(
        '✅ База данных полностью инициализирована'
    );
}

// ============================================
// ADMIN SESSION
// ============================================

function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}


function parseCookies(req) {

    const header =
        req.headers.cookie;


    if (!header) {
        return {};
    }


    const cookies = {};


    header.split(';').forEach(part => {

        const index =
            part.indexOf('=');


        if (index === -1) {
            return;
        }


        const key =
            part.slice(0, index).trim();


        const value =
            part.slice(index + 1).trim();


        cookies[key] =
            decodeURIComponent(value);
    });


    return cookies;
}


async function createAdminSession(adminId) {

    const token =
        generateSessionToken();


    await dbRun(`
        INSERT INTO admin_sessions (
            token,
            admin_id,
            expires_at
        )
        VALUES (
            ?,
            ?,
            datetime(
                'now',
                '+${ADMIN_SESSION_DAYS} days'
            )
        )
    `, [
        token,
        adminId
    ]);


    return token;
}


async function getAdminFromSession(req) {

    const cookies =
        parseCookies(req);


    const token =
        cookies.admin_session;


    if (!token) {
        return null;
    }


    const row = await dbGet(`
        SELECT
            a.id,
            a.login,
            a.name,
            a.active
        FROM admin_sessions s
        JOIN admins a
            ON a.id = s.admin_id
        WHERE s.token = ?
          AND s.expires_at > datetime('now')
          AND a.active = 1
        LIMIT 1
    `, [
        token
    ]);


    if (!row) {
        return null;
    }


    return {
        id: row.id,
        login: row.login,
        name: row.name,
        active: row.active
    };
}


async function requireAdmin(req, res, next) {

    try {

        const admin =
            await getAdminFromSession(req);


        if (!admin) {

            return res.status(401).json({
                success: false,
                message: 'Требуется авторизация'
            });
        }


        req.admin = admin;


        next();

    } catch (error) {

        console.error(
            '❌ Ошибка проверки сессии:',
            error
        );


        res.status(500).json({
            success: false,
            message: 'Ошибка авторизации'
        });
    }
}


// ============================================
// API: ADMIN LOGIN
// ============================================

app.post(
    '/api/admin/login',
    async (req, res) => {

        try {

            const login =
                String(
                    req.body?.login || ''
                ).trim();


            const password =
                String(
                    req.body?.password || ''
                );


            if (!login || !password) {

                return res.status(400).json({
                    success: false,
                    message: 'Введите логин и пароль'
                });
            }


            const admin =
                await getAdminByLogin(
                    login
                );


            if (
                !admin ||
                !admin.active
            ) {

                return res.status(401).json({
                    success: false,
                    message: 'Неверный логин или пароль'
                });
            }


            const valid =
                await verifyPassword(
                    password,
                    admin.password_hash
                );


            if (!valid) {

                return res.status(401).json({
                    success: false,
                    message: 'Неверный логин или пароль'
                });
            }


            const token =
                await createAdminSession(
                    admin.id
                );


            res.setHeader(
                'Set-Cookie',
                [
                    `admin_session=${encodeURIComponent(token)}`,
                    'HttpOnly',
                    'SameSite=Lax',
                    'Path=/',
                    `Max-Age=${ADMIN_SESSION_DAYS * 24 * 60 * 60}`
                ].join('; ')
            );


            res.json({
                success: true,
                admin: {
                    id: admin.id,
                    login: admin.login,
                    name: admin.name
                }
            });


        } catch (error) {

            console.error(
                '❌ Ошибка входа администратора:',
                error
            );


            res.status(500).json({
                success: false,
                message: 'Ошибка сервера'
            });
        }
    }
);


// ============================================
// API: ADMIN LOGOUT
// ============================================

app.post(
    '/api/admin/logout',
    async (req, res) => {

        try {

            const cookies =
                parseCookies(req);


            const token =
                cookies.admin_session;


            if (token) {

                await dbRun(`
                    DELETE FROM admin_sessions
                    WHERE token = ?
                `, [
                    token
                ]);
            }


            res.setHeader(
                'Set-Cookie',
                [
                    'admin_session=',
                    'HttpOnly',
                    'SameSite=Lax',
                    'Path=/',
                    'Max-Age=0'
                ].join('; ')
            );


            res.json({
                success: true
            });


        } catch (error) {

            console.error(
                '❌ Ошибка выхода:',
                error
            );


            res.status(500).json({
                success: false,
                message: 'Ошибка сервера'
            });
        }
    }
);


// ============================================
// API: ТЕКУЩИЙ ADMIN
// ============================================

app.get(
    '/api/admin/meapi/admin/me',
    requireAdmin,
    (req, res) => {

        res.json({
            success: true,
            admin: req.admin
        });
    }
);

// ============================================
// API: КАТАЛОГ СТЕЛ
// ============================================

// Получить список всех активных стел
app.get('/api/admin/steles', requireAdmin, (req, res) => {
    db.all(`
        SELECT
            id,
            model_id,
            name,
            model_file,
            width,
            height,
            depth,
            model_type,
            rotation,
            active,
            created_at,
            updated_at
        FROM steles
        ORDER BY id ASC
    `, (err, rows) => {
        if (err) {
            console.error('❌ Ошибка получения стел:', err);
            return res.status(500).json({
                success: false,
                message: 'Ошибка получения каталога стел'
            });
        }

        res.json({
            success: true,
            steles: rows
        });
    });
});


// Публичный список активных стел для конструктора
app.get('/api/steles', (req, res) => {
    db.all(`
        SELECT
            id,
            model_id,
            name,
            model_file,
            width,
            height,
            depth,
            model_type,
            rotation
        FROM steles
        WHERE active = 1
        ORDER BY id ASC
    `, (err, rows) => {
        if (err) {
            console.error('❌ Ошибка получения публичных стел:', err);
            return res.status(500).json({
                success: false,
                message: 'Ошибка получения стел'
            });
        }

        res.json({
            success: true,
            steles: rows
        });
    });
});


// Добавить новую стелу
app.post('/api/admin/steles', requireAdmin, (req, res) => {
    const {
        name,
        model_file,
        width,
        height,
        depth,
        model_type,
        rotation,
        active
    } = req.body;

    if (!name || !model_file) {
        return res.status(400).json({
            success: false,
            message: 'Название и GLB-файл обязательны'
        });
    }

    const cleanName = String(name).trim().slice(0, 200);
    const cleanFile = path.basename(String(model_file).trim());

    if (!cleanFile.toLowerCase().endsWith('.glb')) {
        return res.status(400).json({
            success: false,
            message: 'Разрешены только GLB-файлы'
        });
    }

    const modelId =
        'catalog_stele_' +
        Date.now() +
        '_' +
        Math.random().toString(36).slice(2, 8);

    const w = Number(width) || 0.6;
    const h = Number(height) || 1.3;
    const d = Number(depth) || 0.08;

    const type =
        model_type === 'horizontal'
            ? 'horizontal'
            : 'vertical';

    const rot =
        rotation
            ? String(rotation).slice(0, 100)
            : '';

    const isActive = active === false ? 0 : 1;

    db.run(`
        INSERT INTO steles (
            model_id,
            name,
            model_file,
            width,
            height,
            depth,
            model_type,
            rotation,
            active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        modelId,
        cleanName,
        cleanFile,
        w,
        h,
        d,
        type,
        rot,
        isActive
    ], function(err) {
        if (err) {
            console.error('❌ Ошибка добавления стелы:', err);

            return res.status(500).json({
                success: false,
                message: 'Не удалось добавить стелу'
            });
        }

        res.json({
            success: true,
            message: 'Стела добавлена',
            stele: {
                id: this.lastID,
                model_id: modelId,
                name: cleanName,
                model_file: cleanFile,
                width: w,
                height: h,
                depth: d,
                model_type: type,
                rotation: rot,
                active: isActive
            }
        });
    });
});


// Изменить стелу
app.put('/api/admin/steles/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
        return res.status(400).json({
            success: false,
            message: 'Некорректный ID'
        });
    }

    const {
        name,
        model_file,
        width,
        height,
        depth,
        model_type,
        rotation,
        active
    } = req.body;

    const cleanName = String(name || '').trim().slice(0, 200);
    const cleanFile = path.basename(String(model_file || '').trim());

    if (!cleanName || !cleanFile) {
        return res.status(400).json({
            success: false,
            message: 'Название и GLB-файл обязательны'
        });
    }

    if (!cleanFile.toLowerCase().endsWith('.glb')) {
        return res.status(400).json({
            success: false,
            message: 'Разрешены только GLB-файлы'
        });
    }

    db.run(`
        UPDATE steles
        SET
            name = ?,
            model_file = ?,
            width = ?,
            height = ?,
            depth = ?,
            model_type = ?,
            rotation = ?,
            active = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [
        cleanName,
        cleanFile,
        Number(width) || 0.6,
        Number(height) || 1.3,
        Number(depth) || 0.08,
        model_type === 'horizontal' ? 'horizontal' : 'vertical',
        rotation ? String(rotation).slice(0, 100) : '',
        active === false ? 0 : 1,
        id
    ], function(err) {
        if (err) {
            console.error('❌ Ошибка изменения стелы:', err);

            return res.status(500).json({
                success: false,
                message: 'Не удалось изменить стелу'
            });
        }

        if (this.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Стела не найдена'
            });
        }

        res.json({
            success: true,
            message: 'Стела изменена'
        });
    });
});


// Удалить стелу
app.delete('/api/admin/steles/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
        return res.status(400).json({
            success: false,
            message: 'Некорректный ID'
        });
    }

    db.get(
        'SELECT model_id, model_file FROM steles WHERE id = ?',
        [id],
        (err, stele) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Ошибка поиска стелы'
                });
            }

            if (!stele) {
                return res.status(404).json({
                    success: false,
                    message: 'Стела не найдена'
                });
            }

            db.run(
                'DELETE FROM steles WHERE id = ?',
                [id],
                function(deleteErr) {
                    if (deleteErr) {
                        console.error(
                            '❌ Ошибка удаления стелы:',
                            deleteErr
                        );

                        return res.status(500).json({
                            success: false,
                            message: 'Не удалось удалить стелу'
                        });
                    }

                    res.json({
                        success: true,
                        message: 'Стела удалена'
                    });
                }
            );
        }
    );
});

// ============================================
// API: ЦЕНЫ
// ============================================

app.get(
    '/api/admin/prices',
    requireAdmin,
    async (req, res) => {

        try {

            const prices =
                await getPrices();


            res.json(prices);


        } catch (error) {

            console.error(
                '❌ Ошибка получения цен:',
                error
            );


            res.status(500).json({
                success: false,
                message: 'Ошибка получения цен'
            });
        }
    }
);


app.post(
    '/api/admin/prices',
    requireAdmin,
    async (req, res) => {

        try {

            const incomingPrices =
                req.body?.prices;


            if (
                !incomingPrices ||
                typeof incomingPrices !== 'object' ||
                Array.isArray(incomingPrices)
            ) {

                return res.status(400).json({
                    success: false,
                    message: 'Некорректные данные цен'
                });
            }


            let count = 0;


            for (
                const [key, rawValue]
                of Object.entries(incomingPrices)
            ) {

                if (
                    !ALLOWED_PRICE_KEYS.has(key)
                ) {
                    continue;
                }


                const value =
                    Number(rawValue);


                if (
                    !Number.isFinite(value) ||
                    value < 0 ||
                    value > 1000000000
                ) {

                    return res.status(400).json({
                        success: false,
                        message:
                            `Некорректная цена: ${key}`
                    });
                }


                const result =
                    await dbRun(`
                        UPDATE prices
                        SET
                            value = ?,
                            updated_at =
                                CURRENT_TIMESTAMP
                        WHERE key = ?
                    `, [
                        Math.round(value),
                        key
                    ]);


                if (result.changes > 0) {

                    count++;

                } else {

                    await dbRun(`
                        INSERT OR IGNORE INTO prices (
                            key,
                            value
                        )
                        VALUES (?, ?)
                    `, [
                        key,
                        Math.round(value)
                    ]);

                    count++;
                }
            }


            pricesCache = null;
            pricesCacheTime = 0;


            res.json({
                success: true,
                message:
                    `Обновлено ${count} цен`
            });


        } catch (error) {

            console.error(
                '❌ Ошибка сохранения цен:',
                error
            );


            res.status(500).json({
                success: false,
                message: 'Ошибка сохранения цен'
            });
        }
    }
);


// ============================================
// API: ПУБЛИЧНЫЕ ЦЕНЫ
// ============================================
//
// Конструктор получает цены без авторизации.
//
// В Variant 1 это цены конкретной установки
// / конкретного клиента.
//
// Никакого admin_id здесь нет.
//

app.get(
    '/api/prices',
    async (req, res) => {

        try {

            if (
                pricesCache &&
                (Date.now() - pricesCacheTime) < 30000
            ) {

                return res.json(
                    pricesCache
                );
            }


            const prices =
                await getPrices();


            pricesCache =
                prices;


            pricesCacheTime =
                Date.now();


            res.json(prices);


        } catch (error) {

            console.error(
                '❌ Ошибка получения публичных цен:',
                error
            );


            res.status(500).json({
                error: 'Ошибка сервера'
            });
        }
    }
);


// ============================================
// СТАРТ БД
// ============================================

initDB().catch(error => {

    console.error(
        '❌ Критическая ошибка инициализации БД:',
        error
    );


    process.exit(1);
});

// ============================================
// API: ЗАКАЗЫ (ПОЛНЫЙ ПАКЕТ: PDF + JSON)
// ============================================

app.post('/api/order', async (req, res) => {
    // ⭐ Санитизируем все входящие данные
    const rawData = req.body;
    const data = sanitizeObject(rawData);
    
    // ============================================================
    // 1. ИЗВЛЕКАЕМ ВСЕ ДАННЫЕ (ПОЛНАЯ СПЕЦИФИКАЦИЯ)
    // ============================================================
    
    // --- КЛИЕНТ ---
    const clientName = data.clientName || 'Не указано';
    const clientPhone = data.clientPhone || 'Не указан';
    const clientEmail = data.clientEmail || 'Не указан';
    const comment = data.comment || 'Нет';
    
    // --- ИНФОРМАЦИЯ О ПРОЕКТЕ ---
    const projectName = data.projectName || 'Без названия';
    const steleName = data.steleName || 'Стандартная';
    const fontFamily = data.fontFamily || 'Arial, sans-serif';
    
    // --- ПАРАМЕТРЫ СТЕЛЫ ---
    const steleW = data.steleWidth || 0.6;
    const steleH = data.steleHeight || 1.2;
    const steleMat = data.steleMaterial || 'Гранит';
    const steleType = data.steleType || 'rectangle';
    const graveW = data.graveWidth || 0.9;
    const graveL = data.graveLength || 1.5;
    const baseH = data.baseHeight || 0.15;
    
    // --- ТЕКСТ ---
    const fullName = data.fullName || 'Не указано';
    const dates = data.dates || 'Не указаны';
    const epitaph = data.epitaph || 'Не указана';
    const font = data.fontFamily || fontFamily;
    const textColor = data.textColor || '#FFFFFF';
    const nameFontSize = data.nameFontSize || 24;
    const datesFontSize = data.datesFontSize || 24;
    const epitaphFontSize = data.epitaphFontSize || 24;
    const textOffsetX = data.textOffsetX || 0;
    const textOffsetY = data.textOffsetY || 0;
    const epitaphOffsetX = data.epitaphOffsetX || 0;
    const epitaphOffsetY = data.epitaphOffsetY || 0;
    
    // --- ФОТО ---
    const hasPhoto = data.textureUrl ? 'Загружено' : 'Не загружено';
    const photoShape = data.photoShape || 'Овал';
    const photoScale = data.photoScale || 1.0;
    const photoWidthMm = data.photoWidthMm || 100;
    const photoHeightMm = data.photoHeightMm || 140;
    const photoOffsetX = data.photoOffsetX || 0;
    const photoOffsetY = data.photoOffsetY || 0;
    const textureUrl = data.textureUrl || null;
    
    // --- ЦВЕТНИК ---
    const flowerEnabled = data.flowerEnabled || false;
    const flowerW = data.flowerWidth || 0.6;
    const flowerL = data.flowerLength || 0.9;
    const flowerType = data.flowerbedType || 'Газон';
    const flowerColor = data.flowerColor || '#4caf50';
    const flowerPosX = data.flowerPosX || 0;
    const flowerPosZ = data.flowerPosZ || 0;
    
    // --- ДОРОЖКА ---
    const pathEnabled = data.pathEnabled || false;
    const pathWidth = data.pathWidth || 0.5;
    const pathMaterial = data.pathMaterial || 'tile_gray';
    const pathColor = data.pathColor || '#888888';
    const pathTileSize = data.pathTileSize || 0.3;
    const pathJointColor = data.pathJointColor || '#666666';
    const pathTileLayout = data.pathTileLayout || 'brick';
    
    // --- ОГРАДКА ---
    const fenceEnabled = data.fenceEnabled || false;
    const fenceW = data.fenceWidth || 1.5;
    const fenceL = data.fenceLength || 2.5;
    const fenceType = data.fenceType || 'Нет';
    const fenceH = data.fenceHeight || 0.6;
    const fenceMat = data.fenceMaterial || 'Черный металл';
    const gateSide = data.fenceGateSide || 'Нет';
    const gateW = data.gateWidth || 0.8;
    const fenceOffX = data.fenceOffsetX || 0;
    const fenceOffZ = data.fenceOffsetZ || 0;
    
    // --- ГРАВИРОВКИ ---
    const frontEngravings = data.engravingsFront || [];
    const backEngravings = data.engravingsBack || [];
    const engravingList = [];
    frontEngravings.forEach(e => engravingList.push(`• ${e.name || e.type} (перед) ×${e.scale || 1.0}`));
    backEngravings.forEach(e => engravingList.push(`• ${e.name || e.type} (зад) ×${e.scale || 1.0}`));
    
    // --- МЕБЕЛЬ И ВАЗЫ ---
    const furnitureScale = data.furnitureScale || 1.0;
    const showFurniture = data.showFurniture !== undefined ? data.showFurniture : true;
    const vaseScale = data.vaseScale || 1.0;
    const vaseMat = data.vaseMaterial || 'marble';
    const showVases = data.showVases !== undefined ? data.showVases : true;
    const tableCount = data.tableCount || 0;
    const benchCount = data.benchCount || 0;
    const picnicCount = data.picnicCount || 0;
    
    // --- 3D МОДЕЛИ ---
    const modelScale = data.modelScale || 1.0;
    const modelPosY = data.modelPosY || 0.31;
    const modelMaterial = data.modelMaterial || 'original';
    const modelFrontText = data.modelFrontText || '';
    const modelFrontFontSize = data.modelFrontFontSize || 36;
    const modelBackName = data.modelBackName || '';
    const modelBackDates = data.modelBackDates || '';
    const modelBackFontSize = data.modelBackFontSize || 48;
    const frontDecalSize = data.frontDecalSize || 0.85;
    const backDecalSize = data.backDecalSize || 0.65;
    const frontPosX = data.frontPosX || -0.05;
    const frontPosY = data.frontPosY || 0.74;
    const frontPosZ = data.frontPosZ || -0.76;
    const backPosX = data.backPosX || -0.07;
    const backPosY = data.backPosY || 0.64;
    const backPosZ = data.backPosZ || -0.69;
    
    // --- СТОИМОСТЬ ---
    const total = data.totalPrice || 0;
    
    // ============================================================
    // 2. ФОРМИРУЕМ ПУТИ К ФАЙЛАМ
    // ============================================================
    const dir = path.join(__dirname, 'storage', 'orders');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    
    const timestamp = Date.now();
    const pdfFileName = `${dir}/estimate_${timestamp}.pdf`;
    const jsonFileName = `${dir}/project_${timestamp}.json`;
    const fullPdfPath = path.resolve(pdfFileName);
    const fullJsonPath = path.resolve(jsonFileName);
    
    // ============================================================
    // 3. СОХРАНЯЕМ JSON-ФАЙЛ ПРОЕКТА (ПОЛНАЯ ВЕРСИЯ)
    // ============================================================
    const cleanProjectData = { 
        version: '2.0',
        savedAt: new Date().toISOString(),
        
        projectInfo: {
            name: projectName,
            steleName: steleName,
            steleType: steleType,
            fontFamily: fontFamily,
            material: steleMat,
            fullName: fullName,
            dates: dates,
            hasPhoto: !!textureUrl,
            createdAt: new Date().toISOString()
        },
        
        projectName: projectName,
        steleName: steleName,
        fontFamily: fontFamily,
        width: steleW,
        height: steleH,
        depth: data.depth || 0.08,
        material: steleMat,
        steleType: steleType,
        fullName: fullName,
        dates: dates,
        epitaph: epitaph,
        textColor: textColor,
        nameFontSize: nameFontSize,
        datesFontSize: datesFontSize,
        epitaphFontSize: epitaphFontSize,
        textOffsetX: textOffsetX,
        textOffsetY: textOffsetY,
        epitaphOffsetX: epitaphOffsetX,
        epitaphOffsetY: epitaphOffsetY,
        textureUrl: textureUrl,
        photoShape: photoShape,
        photoWidthMm: photoWidthMm,
        photoHeightMm: photoHeightMm,
        photoScale: photoScale,
        photoOffsetX: photoOffsetX,
        photoOffsetY: photoOffsetY,
        graveWidth: graveW,
        graveLength: graveL,
        baseHeight: baseH,
        flowerEnabled: flowerEnabled,
        flowerWidth: flowerW,
        flowerLength: flowerL,
        flowerbedType: flowerType,
        flowerColor: flowerColor,
        flowerPosX: flowerPosX,
        flowerPosZ: flowerPosZ,
        pathEnabled: pathEnabled,
        pathWidth: pathWidth,
        pathMaterial: pathMaterial,
        pathColor: pathColor,
        pathTileSize: pathTileSize,
        pathJointColor: pathJointColor,
        pathTileLayout: pathTileLayout,
        fenceEnabled: fenceEnabled,
        fenceWidth: fenceW,
        fenceLength: fenceL,
        fenceType: fenceType,
        fenceHeight: fenceH,
        fenceMaterial: fenceMat,
        fenceGateSide: gateSide,
        gateWidth: gateW,
        fenceOffsetX: fenceOffX,
        fenceOffsetZ: fenceOffZ,
        
        engravingsFront: frontEngravings,
        engravingsBack: backEngravings,
        
        furniture: data.furniture || [],
        furnitureScale: furnitureScale,
        showFurniture: showFurniture,
        tableCount: tableCount,
        benchCount: benchCount,
        picnicCount: picnicCount,

		monuments: data.monuments || [],
	
        vases: data.vases || [],
        vaseScale: vaseScale,
        vaseMaterial: vaseMat,
        showVases: showVases,
        
        modelScale: modelScale,
        modelPosY: modelPosY,
        modelMaterial: modelMaterial,
        modelFrontText: modelFrontText,
        modelFrontFontSize: modelFrontFontSize,
        modelBackName: modelBackName,
        modelBackDates: modelBackDates,
        modelBackFontSize: modelBackFontSize,
        frontDecalSize: frontDecalSize,
        backDecalSize: backDecalSize,
        frontPosX: frontPosX,
        frontPosY: frontPosY,
        frontPosZ: frontPosZ,
        backPosX: backPosX,
        backPosY: backPosY,
        backPosZ: backPosZ,
        totalPrice: total,
        clientName: clientName,
        clientPhone: clientPhone,
        clientEmail: clientEmail,
        comment: comment,
        
        metadata: {
            projectName: projectName,
            steleName: steleName,
            steleType: steleType,
            fontFamily: fontFamily,
            material: steleMat,
            hasPhoto: !!textureUrl,
            hasFurniture: (tableCount + benchCount + picnicCount) > 0,
            hasVases: (data.vases?.length || 0) > 0,
            savedAt: new Date().toISOString()
        }
    };
        
    fs.writeFileSync(fullJsonPath, JSON.stringify(cleanProjectData, null, 2));
    console.log(`✅ JSON проекта сохранён: ${jsonFileName}`);
    
    // ============================================================
    // 4. ГЕНЕРИРУЕМ ДЕТАЛЬНЫЙ HTML ДЛЯ PDF (ПОЛНАЯ ВЕРСИЯ)
    // ============================================================
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Смета на памятник</title>
        <style>
            body { font-family: 'Times New Roman', serif; padding: 30px; background: #fff; color: #222; }
            h1 { color: #1a1a2e; border-bottom: 2px solid #1a1a2e; padding-bottom: 10px; }
            h2 { color: #1a1a2e; margin-top: 25px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
            .project-title { background: #f0f4f8; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .project-title h1 { border-bottom: none; margin: 0; color: #00a896; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .price-total { font-size: 28px; font-weight: bold; color: #00a896; }
            .detail-item { margin: 5px 0; }
            .highlight { background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
            .info-item { background: #f9f9f9; padding: 10px; border-radius: 6px; }
            .info-item strong { color: #1a1a2e; }
            .badge { display: inline-block; padding: 2px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
            .badge-on { background: #00a896; color: #fff; }
            .badge-off { background: #e74c3c; color: #fff; }
        </style>
    </head>
    <body>
        <div class="project-title">
            <h1>📁 ${projectName}</h1>
            <p style="margin: 5px 0 0 0; color: #666;">${steleName} • ${steleMat} • ${steleW}×${steleH} м</p>
            <p style="margin: 5px 0 0 0; color: #888; font-size: 14px;">Шрифт: ${fontFamily}</p>
        </div>
        
        <p><strong>Клиент:</strong> ${clientName}<br>
        <strong>Телефон:</strong> ${clientPhone}<br>
        <strong>Email:</strong> ${clientEmail}<br>
        <strong>Комментарий:</strong> ${comment}</p>

        <h2>📐 ПАРАМЕТРЫ ПАМЯТНИКА</h2>
        <table>
            <tr><th>Стела</th><td>${steleW}×${steleH} м</td><th>Материал</th><td>${steleMat}</td></tr>
            <tr><th>Тип стелы</th><td>${steleName}</td><th>Основание</th><td>${graveW}×${graveL} м</td></tr>
            <tr><th>Высота основания</th><td>${baseH} м</td><th>Цветник</th><td>${flowerEnabled ? '<span class="badge badge-on">Включён</span>' : '<span class="badge badge-off">Отключён</span>'}</td></tr>
            <tr><th>Размер цветника</th><td>${flowerEnabled ? flowerW+'×'+flowerL+' м' : '—'}</td><th>Покрытие</th><td>${flowerEnabled ? flowerType : '—'}</td></tr>
            <tr><th>Дорожка</th><td>${pathEnabled ? '<span class="badge badge-on">Включена</span>' : '<span class="badge badge-off">Отключена</span>'}</td><th>Ширина дорожки</th><td>${pathEnabled ? pathWidth+' м' : '—'}</td></tr>
        </table>

        <h2>🖼️ ОФОРМЛЕНИЕ</h2>
        <table>
            <tr><th>ФИО</th><td>${fullName}</td><th>Даты</th><td>${dates}</td></tr>
            <tr><th>Эпитафия</th><td colspan="3">${epitaph}</td></tr>
            <tr><th>Шрифт</th><td>${font}</td><th>Цвет</th><td style="background:${textColor}; color:${textColor === '#FFFFFF' ? '#000' : '#fff'};">${textColor}</td></tr>
            <tr><th>Размер ФИО</th><td>${nameFontSize}</td><th>Размер дат</th><td>${datesFontSize}</td></tr>
            <tr><th>Размер эпитафии</th><td>${epitaphFontSize}</td><th>Сдвиг ФИО</th><td>X: ${textOffsetX}, Y: ${textOffsetY}</td></tr>
            <tr><th>Сдвиг эпитафии</th><td>X: ${epitaphOffsetX}, Y: ${epitaphOffsetY}</td><th>Фото</th><td>${hasPhoto}</td></tr>
            <tr><th>Форма фото</th><td>${photoShape}</td><th>Масштаб фото</th><td>${photoScale}</td></tr>
            <tr><th>Размер фото</th><td>${photoWidthMm}×${photoHeightMm} мм</td><th>Сдвиг фото</th><td>X: ${photoOffsetX}, Y: ${photoOffsetY}</td></tr>
        </table>

        <h2>🎨 ГРАВИРОВКИ (${engravingList.length} шт.)</h2>
        <div class="highlight">
            ${engravingList.length > 0 ? engravingList.join('<br>') : '— Гравировки не выбраны —'}
        </div>
        
        <h2>🪑 ДЕТАЛИ МЕБЕЛИ</h2>
        <table>
            <thead>
                <tr><th>Тип</th><th>Позиция X</th><th>Позиция Z</th><th>Масштаб</th></tr>
            </thead>
            <tbody>
                ${data.furniture && data.furniture.length > 0 ? 
                    data.furniture.map(f => `
                        <tr>
                            <td>${f.type}</td>
                            <td>${f.x.toFixed(2)}</td>
                            <td>${f.z.toFixed(2)}</td>
                            <td>${f.scale || 1.0}</td>
                        </tr>
                    `).join('') : 
                    '<tr><td colspan="4" style="text-align:center;color:#999;">Нет мебели</td></tr>'
                }
            </tbody>
        </table>

        <h2>🏺 ДЕТАЛИ ВАЗ</h2>
        <table>
            <thead>
                <tr><th>Тип</th><th>Позиция X</th><th>Позиция Z</th><th>Масштаб</th><th>Материал</th></tr>
            </thead>
            <tbody>
                ${data.vases && data.vases.length > 0 ? 
                    data.vases.map(v => `
                        <tr>
                            <td>${v.type}</td>
                            <td>${v.x.toFixed(2)}</td>
                            <td>${v.z.toFixed(2)}</td>
                            <td>${v.scale || 1.0}</td>
                            <td>${v.material || 'marble'}</td>
                        </tr>
                    `).join('') : 
                    '<tr><td colspan="5" style="text-align:center;color:#999;">Нет ваз</td></tr>'
                }
            </tbody>
        </table>
        
        <h2>🚧 ОГРАДКА</h2>
        <table>
            <tr><th>Статус</th><td>${fenceEnabled ? '<span class="badge badge-on">Включена</span>' : '<span class="badge badge-off">Отключена</span>'}</td></tr>
            <tr><th>Размер</th><td>${fenceW}×${fenceL} м</td><th>Тип</th><td>${fenceType}</td></tr>
            <tr><th>Материал</th><td>${fenceMat}</td><th>Высота</th><td>${fenceH} м</td></tr>
            <tr><th>Вход</th><td>${gateSide}</td><th>Ширина входа</th><td>${gateW} м</td></tr>
            <tr><th>Смещение</th><td colspan="3">X: ${fenceOffX}, Z: ${fenceOffZ}</td></tr>
        </table>

        <h2>🪑 ДЕКОР И МЕБЕЛЬ</h2>
        <table>
            <tr><th>Столы</th><td>${tableCount} шт.</td><th>Скамейки</th><td>${benchCount} шт.</td></tr>
            <tr><th>Наборы</th><td>${picnicCount} шт.</td><th>Масштаб мебели</th><td>${furnitureScale}</td></tr>
            <tr><th>Масштаб ваз</th><td>${vaseScale}</td><th>Материал ваз</th><td>${vaseMat}</td></tr>
            <tr><th>Показывать мебель</th><td>${showFurniture ? '✅ Да' : '❌ Нет'}</td><th>Показывать вазы</th><td>${showVases ? '✅ Да' : '❌ Нет'}</td></tr>
        </table>

        <h2>💰 СТОИМОСТЬ</h2>
        <div class="price-total">${total.toLocaleString('ru-RU')} ₽</div>

        <p style="margin-top: 30px; color: #888; font-size: 12px;">
            *Срок изготовления: 7-14 рабочих дней. Предоплата 50%.<br>
            Giga-NT 3D Конструктор Памятников<br>
            Файл проекта (.json) приложен к письму.
        </p>
    </body>
    </html>
    `;
    
    // ============================================================
    // 5. ГЕНЕРИРУЕМ PDF
    // ============================================================
    try {
        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(htmlContent);
        await page.pdf({ path: fullPdfPath, format: 'A4', margin: { top: '20px', bottom: '20px' } });
        await browser.close();
        console.log(`✅ PDF смета создана: ${pdfFileName}`);
    } catch (error) {
        console.error('❌ Ошибка генерации PDF:', error);
        return res.status(500).json({ success: false, message: 'Ошибка генерации PDF' });
    }
    
    // ============================================================
    // 6. ОТПРАВКА ПИСЬМА
    // ============================================================
    try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: EMAIL_USER,
                pass: EMAIL_PASS
            }
        });
        
        const mailOptions = {
            from: EMAIL_USER,
            to: EMAIL_USER,
            subject: `🪦 ${projectName} - Смета на памятник + JSON проект`,
            text: `Уважаемый клиент!\n\nПроект: ${projectName}\nКлиент: ${clientName}\nСтелa: ${steleName} (${steleW}×${steleH} м, ${steleMat})\nШрифт: ${fontFamily}\nСтоимость: ${total.toLocaleString('ru-RU')} ₽\n\nВо вложении:\n1. Смета.pdf — полный отчёт по заказу.\n2. project.json — проект для открытия в 3D конструкторе.\n\nС уважением, Giga-NT.`,
            attachments: [
                {
                    filename: `Смета_${projectName.replace(/\s+/g, '_')}_${timestamp}.pdf`,
                    path: fullPdfPath
                },
                {
                    filename: `project_${projectName.replace(/\s+/g, '_')}_${timestamp}.json`,
                    path: fullJsonPath
                }
            ]
        };
        
        await transporter.sendMail(mailOptions);
        console.log('✅ Письмо с PDF и JSON отправлено!');
        
        // 7. УДАЛЯЕМ ВРЕМЕННЫЕ ФАЙЛЫ
        fs.unlinkSync(fullPdfPath);
        fs.unlinkSync(fullJsonPath);
        console.log('🧹 Временные файлы удалены.');
        
        res.json({ 
            success: true, 
            message: '✅ Смета и проект отправлены на почту (PDF + JSON)!',
            projectName: projectName,
            fileName: `project_${projectName.replace(/\s+/g, '_')}_${timestamp}.json`
        });
        
    } catch (error) {
        console.error('❌ Ошибка отправки email:', error);
        res.json({ 
            success: true, 
            message: '✅ Заказ принят (файлы созданы локально). Мы свяжемся с вами.' 
        });
    }
});

// ============================================
// API: ПРОЕКТЫ
// ============================================

app.get('/api/projects', (req, res) => {
    try {
        const projectsFile = path.join(__dirname, 'data', 'projects.json');
        
        if (fs.existsSync(projectsFile)) {
            const data = fs.readFileSync(projectsFile, 'utf8');
            const projects = JSON.parse(data);
            res.json(projects);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Ошибка загрузки проектов:', error);
        res.status(500).json({ error: 'Ошибка загрузки проектов' });
    }
});

app.post('/api/projects', (req, res) => {
    try {
        const rawProject = req.body;
        // ⭐ Санитизируем проект перед сохранением
        const project = sanitizeObject(rawProject);
        project.serverSavedAt = new Date().toISOString();
        
        const projectsFile = path.join(__dirname, 'data', 'projects.json');
        const dataDir = path.join(__dirname, 'data');
        
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        let projects = [];
        if (fs.existsSync(projectsFile)) {
            const data = fs.readFileSync(projectsFile, 'utf8');
            projects = JSON.parse(data);
        }
        
        const existingIndex = projects.findIndex(p => p.id === project.id);
        if (existingIndex >= 0) {
            projects[existingIndex] = project;
        } else {
            projects.push(project);
        }
        
        fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2), 'utf8');
        
        res.json({ 
            success: true, 
            message: 'Проект сохранён',
            id: project.id
        });
    } catch (error) {
        console.error('Ошибка сохранения проекта:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка сохранения проекта' 
        });
    }
});

app.delete('/api/projects/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const projectsFile = path.join(__dirname, 'data', 'projects.json');
        
        if (!fs.existsSync(projectsFile)) {
            return res.status(404).json({ error: 'Проектов не найдено' });
        }
        
        const data = fs.readFileSync(projectsFile, 'utf8');
        let projects = JSON.parse(data);
        projects = projects.filter(p => p.id !== id);
        fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2), 'utf8');
        
        res.json({ 
            success: true, 
            message: 'Проект удалён' 
        });
    } catch (error) {
        console.error('Ошибка удаления проекта:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка удаления проекта' 
        });
    }
});

// ============================================
// ЗАПУСК
// ============================================

preCacheFiles();
console.log(`✅ Кэшировано ${fileCache.size} файлов`);



app.post('/api/check-license', (req, res) => {
    const { deviceId } = req.body;
	const whitelistPath = path.join(__dirname, 'storage', 'whitelist.json');
    let whitelist = [];

    if (fs.existsSync(whitelistPath)) {
        try {
            const data = fs.readFileSync(whitelistPath, 'utf8');
            whitelist = JSON.parse(data);
        } catch (e) {}
    }

    // ⭐ ПРОВЕРЯЕМ СТРОГО: если ID есть в списке — true, иначе — false
    const isValid = whitelist.includes(deviceId);
    
    res.json({ valid: isValid });
});


// ============================================================
// ФИКС: ЯВНАЯ РАЗДАЧА ВСЕХ ПАПОК
// ============================================================

// Если modules лежит в корне проекта:
app.use('/modules', express.static(path.join(__dirname, 'modules')));
// Если modules лежит в storage (запасной вариант):
app.use('/modules', express.static(path.join(__dirname, 'storage', 'modules')));

// Если fonts лежит в корне:
app.use('/fonts', express.static(path.join(__dirname, 'fonts')));
// Если fonts лежит в storage:
app.use('/fonts', express.static(path.join(__dirname, 'storage', 'fonts')));

// Если engravings лежит в корне:
app.use('/engravings', express.static(path.join(__dirname, 'engravings')));
// Если engravings лежит в storage:
app.use('/engravings', express.static(path.join(__dirname, 'storage', 'engravings')));

// ============================================================


app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📍 Главная: http://localhost:${PORT}/`);
    console.log(`🔐 Админка: http://localhost:${PORT}/admin`);
    console.log(`📡 API: http://localhost:${PORT}/api/prices`);
    console.log(`🔑 Пароль админа: ${ADMIN_PASSWORD}`);
    console.log(`📦 Кэш памяти: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)}MB`);
});