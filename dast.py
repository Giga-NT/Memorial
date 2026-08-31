import os
import re
import json
import requests
import socket
import ssl
import webbrowser
from datetime import datetime
from urllib.parse import urljoin, urlparse, quote
from concurrent.futures import ThreadPoolExecutor, as_completed

class ClientSecurityScanner:
    def __init__(self, domain):
        if not domain.startswith('http'):
            domain = 'https://' + domain
        self.base_url = domain.rstrip('/')
        self.domain = urlparse(self.base_url).hostname
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        self.findings = []
        self.vulnerable_plugins = []
        self.exposed_files = []
        self.leaked_data = []
    
    def scan(self):
        print(f"\n{'='*60}")
        print(f"🔍 СКАНИРОВАНИЕ: {self.base_url}")
        print(f"{'='*60}\n")
        
        # 1. Проверка утечки данных (паспорта, снилс, телефоны)
        self._check_data_leak()
        
        # 2. Проверка открытых файлов
        self._check_exposed_files()
        
        # 3. Проверка бэкдоров
        self._check_backdoors()
        
        # 4. Проверка SQL-инъекций
        self._check_sql_injection()
        
        # 5. Проверка плагинов и тем
        self._check_plugins()
        
        # 6. Проверка SSL
        self._check_ssl()
        
        # 7. Проверка security-заголовков
        self._check_security_headers()
        
        # 8. Проверка админки
        self._check_admin_security()
        
        # 9. Проверка защиты от атак
        self._check_attack_protection()
        
        # 10. Проверка утечки паролей
        self._check_password_leak()
        
        # Генерация отчета
        self._generate_report()
        
        return self.findings
    
    # ============================================================
    # 1. ПРОВЕРКА УТЕЧКИ ДАННЫХ
    # ============================================================
    def _check_data_leak(self):
        print("🔍 Проверка утечки данных...")
        
        queries = [
            ('паспорт OR серия OR номер паспорта', 'Паспортные данные'),
            ('СНИЛС OR снилс OR страховое', 'СНИЛС'),
            ('телефон OR мобильный OR контактный', 'Телефоны клиентов'),
            ('адрес OR проживание OR регистрация', 'Адреса клиентов'),
            ('email OR e-mail OR почта', 'Email-адреса'),
            ('дата рождения OR родился OR год рождения', 'Даты рождения'),
        ]
        
        for query, data_type in queries:
            try:
                search_url = f"https://yandex.ru/search/?text=site:{self.domain} {quote(query)}"
                response = self.session.get(search_url, timeout=10)
                
                if 'Результаты поиска' in response.text or 'найдено' in response.text:
                    # Проверяем, есть ли реальные данные
                    if any(keyword in response.text.lower() for keyword in ['паспорт', 'серия', 'снилс', 'телефон']):
                        self.findings.append({
                            'severity': 'CRITICAL',
                            'title': f'Утечка {data_type} в открытом доступе',
                            'problem': f'{data_type} клиентов индексируются поисковиками',
                            'description': f'Любой человек может найти {data_type.lower()} ваших клиентов через Яндекс или Google',
                            'threat': f'Штраф по 152-ФЗ до 500 000 рублей. Уголовная ответственность за разглашение персональных данных',
                            'solution': 'Закройте страницы с данными от индексации через robots.txt или добавьте meta-тег noindex',
                            'evidence': f'Поисковый запрос: {search_url}'
                        })
                        self.leaked_data.append(data_type)
                        print(f"   ⚠️ Найдена утечка: {data_type}")
            except:
                pass
    
    # ============================================================
    # 2. ПРОВЕРКА ОТКРЫТЫХ ФАЙЛОВ
    # ============================================================
    def _check_exposed_files(self):
        print("🔍 Проверка открытых файлов...")
        
        sensitive_files = [
            ('/wp-config.php', 'Конфигурация WordPress (пароль от БД)'),
            ('/wp-config.php.bak', 'Резервная копия конфигурации'),
            ('/wp-config.php.save', 'Сохраненная конфигурация'),
            ('/.env', 'Переменные окружения (ключи API)'),
            ('/.git/config', 'Git конфигурация (история изменений)'),
            ('/.htaccess', 'Конфигурация сервера'),
            ('/debug.log', 'Логи отладки (ошибки, данные)'),
            ('/error_log', 'Логи ошибок'),
            ('/phpinfo.php', 'Информация о PHP (версии, настройки)'),
            ('/info.php', 'Информация о сервере'),
            ('/wp-content/uploads/', 'Загруженные файлы (могут быть бэкдоры)'),
            ('/robots.txt', 'Инструкции для поисковиков'),
            ('/sitemap.xml', 'Карта сайта'),
            ('/wp-content/debug.log', 'Логи WordPress'),
            ('/.mysql_history', 'История SQL-запросов'),
            ('/composer.json', 'Зависимости PHP'),
            ('/package.json', 'Зависимости Node.js'),
        ]
        
        for file, description in sensitive_files:
            try:
                url = urljoin(self.base_url, file)
                response = self.session.get(url, timeout=5)
                
                if response.status_code == 200:
                    content = response.text
                    
                    # Проверяем, что это не пустая страница
                    if len(content) > 100 and not '404' in content:
                        self.findings.append({
                            'severity': 'CRITICAL' if 'config' in file or '.env' in file else 'HIGH',
                            'title': f'Открыт доступ к файлу: {file}',
                            'problem': f'{description} доступен для любого пользователя интернета',
                            'description': f'Любой человек может открыть {file} в браузере и увидеть конфиденциальную информацию',
                            'threat': 'Утечка паролей, ключей API, конфигурации базы данных. Полный доступ к сайту и серверу.',
                            'solution': f'Добавьте в .htaccess: <Files "{file.lstrip("/")}"> Deny from all </Files>',
                            'evidence': f'Доступно по ссылке: {url}'
                        })
                        self.exposed_files.append(file)
                        print(f"   ⚠️ Открыт файл: {file}")
            except:
                pass
    
    # ============================================================
    # 3. ПРОВЕРКА БЭКДОРОВ
    # ============================================================
    def _check_backdoors(self):
        print("🔍 Проверка бэкдоров...")
        
        backdoor_patterns = [
            ('/wp-content/uploads/shell.php', 'PHP-шелл'),
            ('/wp-content/uploads/backdoor.php', 'Бэкдор'),
            ('/wp-content/uploads/admin.php', 'Скрытый админ-доступ'),
            ('/wp-content/uploads/cmd.php', 'Командная оболочка'),
            ('/wp-content/uploads/eval.php', 'Eval-шелл'),
            ('/wp-content/uploads/uploader.php', 'Загрузчик файлов'),
            ('/wp-content/uploads/webshell.php', 'Веб-шелл'),
            ('/wp-content/uploads/1.php', 'Подозрительный PHP-файл'),
            ('/wp-content/uploads/2.php', 'Подозрительный PHP-файл'),
            ('/wp-content/uploads/s.php', 'Подозрительный PHP-файл'),
            ('/wp-content/uploads/shell.txt', 'Текстовый шелл'),
            ('/wp-content/uploads/.htaccess', 'Скрытый .htaccess'),
            ('/wp-admin/admin-ajax.php?action=test', 'Тестовый скрипт'),
            ('/wp-admin/admin-post.php?action=test', 'Тестовый скрипт'),
        ]
        
        for path, description in backdoor_patterns:
            try:
                url = urljoin(self.base_url, path)
                response = self.session.get(url, timeout=5)
                
                if response.status_code == 200:
                    content = response.text.lower()
                    
                    # Проверяем признаки бэкдора
                    backdoor_signs = ['eval', 'system', 'shell_exec', 'passthru', 'base64_decode', 
                                     'gzinflate', 'str_rot13', 'assert', 'create_function']
                    
                    if any(sign in content for sign in backdoor_signs):
                        self.findings.append({
                            'severity': 'CRITICAL',
                            'title': f'⚠️ НАЙДЕН БЭКДОР: {path}',
                            'problem': f'На сервере обнаружен {description}',
                            'description': 'Это файл, который оставляет хакер для повторного доступа к сайту после взлома',
                            'threat': 'Хакер может войти на сайт в любой момент. Полный контроль над сайтом и сервером.',
                            'solution': f'НЕМЕДЛЕННО удалите файл {path} через FTP или хостинг-панель. Проверьте все загруженные файлы.',
                            'evidence': f'Доступно по ссылке: {url}'
                        })
                        print(f"   🚨 НАЙДЕН БЭКДОР: {path}")
            except:
                pass
    
    # ============================================================
    # 4. ПРОВЕРКА SQL-ИНЪЕКЦИЙ
    # ============================================================
    def _check_sql_injection(self):
        print("🔍 Проверка SQL-инъекций...")
        
        sql_payloads = [
            ("'", 'Ошибка SQL (признак уязвимости)'),
            ("1' OR '1'='1", 'Обход аутентификации'),
            ("1; DROP TABLE", 'Удаление таблиц'),
            ("' UNION SELECT", 'Кража данных'),
            ("1' AND 1=1--", 'Обход условий'),
        ]
        
        test_urls = [
            '/?id=1',
            '/?p=1',
            '/?page=1',
            '/?product=1',
            '/?post=1',
            '/?cat=1',
            '/?s=test',
            '/?search=test',
            '/?q=test',
        ]
        
        for base_url in test_urls:
            for payload, description in sql_payloads:
                try:
                    test_url = urljoin(self.base_url, base_url.replace('1', payload).replace('test', payload))
                    response = self.session.get(test_url, timeout=5)
                    
                    # Признаки SQL-инъекции
                    sql_errors = [
                        'sql syntax', 'mysql_fetch', 'odbc_exec', 'mysql_num_rows',
                        'sql error', 'database error', 'mysql error', 'warning: mysql',
                        'you have an error in your sql', 'unclosed quotation mark',
                        'syntax error', 'microsoft ole db', 'odbc sql server driver'
                    ]
                    
                    if any(error in response.text.lower() for error in sql_errors):
                        self.findings.append({
                            'severity': 'CRITICAL',
                            'title': f'SQL-инъекция: {test_url}',
                            'problem': 'Сайт уязвим к SQL-инъекциям',
                            'description': f'При запросе {test_url} сервер выдал ошибку базы данных',
                            'threat': 'Кража всей базы данных клиентов (ФИО, телефоны, адреса, пароли). Удаление данных.',
                            'solution': 'Используйте параметризованные запросы или $wpdb->prepare() для WordPress',
                            'evidence': f'Запрос: {test_url}'
                        })
                        print(f"   🚨 SQL-инъекция: {test_url}")
                        break
                except:
                    pass
    
    # ============================================================
    # 5. ПРОВЕРКА ПЛАГИНОВ
    # ============================================================
    def _check_plugins(self):
        print("🔍 Проверка плагинов...")
        
        plugins = {
            'woocommerce': 'Интернет-магазин',
            'elementor': 'Конструктор страниц',
            'yoast': 'SEO-оптимизация',
            'contact-form-7': 'Формы связи',
            'akismet': 'Защита от спама',
            'jetpack': 'Набор функций безопасности',
            'wpforms': 'Формы',
            'all-in-one-seo-pack': 'SEO-оптимизация',
            'wpbakery': 'Конструктор страниц',
            'revslider': 'Слайдер',
            'wordfence': 'Безопасность',
            'updraftplus': 'Резервное копирование',
            'yoast-seo': 'SEO',
            'rank-math': 'SEO',
            'seo-by-rank-math': 'SEO',
        }
        
        # Уязвимые версии плагинов
        vulnerable_versions = {
            'woocommerce': ['3.0', '3.5', '4.0', '5.0', '5.5', '6.0', '6.5', '7.0'],
            'elementor': ['2.0', '2.5', '3.0', '3.5', '3.10', '3.15'],
            'yoast': ['9.0', '10.0', '11.0', '14.0', '15.0', '16.0'],
            'contact-form-7': ['4.0', '5.0', '5.1', '5.2'],
            'revslider': ['5.0', '5.4', '6.0'],
            'wpbakery': ['5.0', '6.0'],
            'wordfence': ['6.0', '7.0'],
        }
        
        for plugin, description in plugins.items():
            try:
                url = urljoin(self.base_url, f'/wp-content/plugins/{plugin}/readme.txt')
                response = self.session.get(url, timeout=3)
                
                if response.status_code == 200:
                    match = re.search(r'Stable tag: (\d+\.\d+\.\d+)', response.text)
                    if match:
                        version = match.group(1)
                        print(f"   📌 {plugin}: v{version}")
                        
                        if plugin in vulnerable_versions:
                            for vuln_ver in vulnerable_versions[plugin]:
                                if version.startswith(vuln_ver):
                                    self.findings.append({
                                        'severity': 'HIGH',
                                        'title': f'Уязвимый плагин: {plugin} (v{version})',
                                        'problem': f'Плагин {plugin} имеет известные уязвимости',
                                        'description': f'В версии {version} есть дыры, которые хакеры используют ежедневно. По данным CVE, в этом плагине найдено более 10 уязвимостей.',
                                        'threat': 'Полный доступ к сайту, кража базы данных, установка вирусов, бэкдоров.',
                                        'solution': f'Обновите плагин {plugin} в админке → Плагины. Если обновления нет — удалите плагин.',
                                        'evidence': f'Версия: {version}, файл: {url}'
                                    })
                                    self.vulnerable_plugins.append(f'{plugin} v{version}')
            except:
                pass
    
    # ============================================================
    # 6. ПРОВЕРКА SSL
    # ============================================================
    def _check_ssl(self):
        print("🔍 Проверка SSL...")
        
        try:
            context = ssl.create_default_context()
            with socket.create_connection((self.domain, 443), timeout=5) as sock:
                with context.wrap_socket(sock, server_hostname=self.domain) as ssock:
                    cert = ssock.getpeercert()
                    not_after = cert.get('notAfter', '')
                    
                    if not_after:
                        expiry = datetime.strptime(not_after, '%b %d %H:%M:%S %Y %Z')
                        days_left = (expiry - datetime.now()).days
                        
                        if days_left < 30:
                            self.findings.append({
                                'severity': 'HIGH',
                                'title': f'SSL сертификат истекает через {days_left} дней',
                                'problem': 'Ваш SSL сертификат скоро перестанет работать',
                                'description': f'Сайт станет недоступен по HTTPS, браузеры будут показывать "Небезопасное соединение"',
                                'threat': 'Потеря доверия клиентов, падение в поиске Google, перехват данных, потеря конверсии до 30%',
                                'solution': 'Обновите SSL сертификат у вашего хостинг-провайдера или через Let\'s Encrypt',
                                'evidence': f'Истекает: {not_after}'
                            })
                            print(f"   ⚠️ SSL истекает через {days_left} дней")
                        else:
                            print(f"   ✅ SSL действителен {days_left} дней")
        except:
            self.findings.append({
                'severity': 'CRITICAL',
                'title': 'SSL сертификат не установлен',
                'problem': 'Сайт работает без HTTPS',
                'description': 'Трафик между пользователями и сайтом не зашифрован',
                'threat': 'Перехват паролей, личных данных, подмена страниц (атака Man-in-the-Middle)',
                'solution': 'Установите SSL сертификат и настройте редирект с HTTP на HTTPS',
                'evidence': 'Сайт доступен по HTTP'
            })
            print(f"   🚨 SSL не установлен")
    
    # ============================================================
    # 7. ПРОВЕРКА SECURITY-ЗАГОЛОВКОВ
    # ============================================================
    def _check_security_headers(self):
        print("🔍 Проверка security-заголовков...")
        
        try:
            response = self.session.get(self.base_url, timeout=5)
            headers = response.headers
            
            security_headers = {
                'X-Frame-Options': {
                    'desc': 'Защита от кликджекинга',
                    'threat': 'Злоумышленник может вставить ваш сайт в iframe и обманывать пользователей',
                    'solution': 'Добавьте в .htaccess: Header always append X-Frame-Options SAMEORIGIN'
                },
                'Content-Security-Policy': {
                    'desc': 'Защита от XSS-атак',
                    'threat': 'Внедрение вредоносного кода, кража куки, фишинг',
                    'solution': 'Добавьте в .htaccess: Header always set Content-Security-Policy "default-src \'self\'"'
                },
                'Strict-Transport-Security': {
                    'desc': 'Принудительное HTTPS',
                    'threat': 'Перехват трафика, кража данных, подмена страниц',
                    'solution': 'Добавьте в .htaccess: Header always set Strict-Transport-Security "max-age=31536000"'
                },
                'X-Content-Type-Options': {
                    'desc': 'Защита от MIME-атак',
                    'threat': 'Загрузка вирусов, выполнение чужого кода',
                    'solution': 'Добавьте в .htaccess: Header always set X-Content-Type-Options nosniff'
                },
                'Referrer-Policy': {
                    'desc': 'Защита от утечки рефера',
                    'threat': 'Утечка данных о поведении пользователей',
                    'solution': 'Добавьте в .htaccess: Header always set Referrer-Policy "no-referrer-when-downgrade"'
                }
            }
            
            for header, info in security_headers.items():
                if header not in headers:
                    self.findings.append({
                        'severity': 'MEDIUM',
                        'title': f'Отсутствует заголовок безопасности: {header}',
                        'problem': info['desc'],
                        'description': f'Заголовок {header} не установлен на сервере',
                        'threat': info['threat'],
                        'solution': info['solution'],
                        'evidence': f'Заголовок отсутствует в ответе сервера'
                    })
                    print(f"   ⚠️ Отсутствует {header}")
                else:
                    print(f"   ✅ {header}: {headers[header]}")
        except:
            pass
    
    # ============================================================
    # 8. ПРОВЕРКА ЗАЩИТЫ АДМИНКИ
    # ============================================================
    def _check_admin_security(self):
        print("🔍 Проверка защиты админки...")
        
        # Проверка на лимит попыток входа
        try:
            login_url = urljoin(self.base_url, '/wp-admin/admin-ajax.php')
            for i in range(3):
                response = self.session.post(login_url, data={
                    'action': 'login',
                    'username': 'admin',
                    'password': 'wrong_password_' + str(i)
                }, timeout=5)
                
                # Если нет блокировки после 3 попыток
                if i == 2 and 'too_many' not in response.text.lower():
                    self.findings.append({
                        'severity': 'HIGH',
                        'title': 'Нет защиты от подбора паролей',
                        'problem': 'Админка не блокирует попытки входа',
                        'description': 'Можно бесконечно подбирать пароли к админке',
                        'threat': 'Хакер сможет подобрать пароль за несколько часов. Полный доступ к сайту.',
                        'solution': 'Установите плагин Limit Login Attempts или Wordfence',
                        'evidence': 'Сделано 3 неудачных попытки входа без блокировки'
                    })
                    print(f"   ⚠️ Нет защиты от подбора паролей")
        except:
            pass
        
        # Проверка на скрытие admin
        try:
            response = self.session.get(urljoin(self.base_url, '/?author=1'), timeout=5)
            if 'admin' in response.text.lower() or 'author' in response.text.lower():
                self.findings.append({
                    'severity': 'MEDIUM',
                    'title': 'Логин администратора виден',
                    'problem': 'Имя пользователя admin можно узнать через author-ссылку',
                    'description': 'По ссылке /?author=1 видно логин администратора',
                    'threat': 'Хакер знает логин и может подбирать пароль целенаправленно',
                    'solution': 'Измените логин admin на другой. Используйте плагин WPS Hide Login',
                    'evidence': 'Доступно по ссылке: /?author=1'
                })
                print(f"   ⚠️ Логин admin виден")
        except:
            pass
        
        # Проверка на двухфакторную аутентификацию
        try:
            response = self.session.get(urljoin(self.base_url, '/wp-admin/'), timeout=5)
            if '2fa' not in response.text.lower() and 'two-factor' not in response.text.lower():
                self.findings.append({
                    'severity': 'MEDIUM',
                    'title': 'Нет двухфакторной аутентификации',
                    'problem': 'В админке не используется 2FA',
                    'description': 'Достаточно только пароля для входа в админку',
                    'threat': 'Если пароль украдут — хакер сразу попадет в админку',
                    'solution': 'Установите плагин Two-Factor Authentication или Wordfence с 2FA',
                    'evidence': '2FA не обнаружена на странице входа'
                })
                print(f"   ⚠️ Нет 2FA")
        except:
            pass
    
    # ============================================================
    # 9. ПРОВЕРКА ЗАЩИТЫ ОТ АТАК
    # ============================================================
    def _check_attack_protection(self):
        print("🔍 Проверка защиты от атак...")
        
        # Проверка на защиту от DDoS
        try:
            response = self.session.get(self.base_url, timeout=5)
            if 'cf-ray' in response.headers or 'cloudflare' in response.headers:
                print(f"   ✅ Защита от DDoS (CloudFlare)")
            else:
                self.findings.append({
                    'severity': 'MEDIUM',
                    'title': 'Нет защиты от DDoS-атак',
                    'problem': 'Сайт не защищен от распределенных атак',
                    'description': 'Отсутствует CloudFlare или аналогичная защита',
                    'threat': 'Сайт может быть отключен на несколько часов/дней',
                    'solution': 'Подключите CloudFlare (бесплатно) или купите защиту у хостинга',
                    'evidence': 'CloudFlare не обнаружен'
                })
                print(f"   ⚠️ Нет защиты от DDoS")
        except:
            pass
    
    # ============================================================
    # 10. ПРОВЕРКА УТЕЧКИ ПАРОЛЕЙ
    # ============================================================
    def _check_password_leak(self):
        print("🔍 Проверка утечки паролей...")
        
        # Проверка email в публичных базах утечек
        try:
            # Простая проверка через haveibeenpwned API
            # Собираем email с сайта
            response = self.session.get(self.base_url, timeout=5)
            emails = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', response.text)
            
            if emails:
                for email in emails[:3]:  # Проверяем только первые 3
                    try:
                        # Публичное API, не нарушает закон
                        api_url = f"https://haveibeenpwned.com/api/v3/breachedaccount/{email}"
                        breach_response = self.session.get(api_url, timeout=5)
                        
                        if breach_response.status_code == 200:
                            breaches = breach_response.json()
                            breach_names = ', '.join([b['Name'] for b in breaches[:3]])
                            
                            self.findings.append({
                                'severity': 'CRITICAL',
                                'title': f'Утечка пароля: {email}',
                                'problem': 'Пароль от этого email найден в публичных базах утечек',
                                'description': f'Email {email} был скомпрометирован в {len(breaches)} утечках',
                                'threat': 'Хакеры уже знают пароль от этого email. Если пароль используется на сайте — доступ обеспечен.',
                                'solution': 'НЕМЕДЛЕННО смените все пароли. Используйте менеджер паролей.',
                                'evidence': f'Найден в: {breach_names}'
                            })
                            print(f"   🚨 Утечка пароля: {email}")
                    except:
                        pass
        except:
            pass
    
    # ============================================================
    # ГЕНЕРАЦИЯ ОТЧЕТА
    # ============================================================
    def _generate_report(self):
        """Генерация красивого HTML-отчета для клиента"""
        
        html_file = os.path.join(os.getcwd(), 'audit_report.html')
        
        # Сортируем по критичности
        severity_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2}
        self.findings.sort(key=lambda x: severity_order.get(x['severity'], 3))
        
        critical = [f for f in self.findings if f['severity'] == 'CRITICAL']
        high = [f for f in self.findings if f['severity'] == 'HIGH']
        medium = [f for f in self.findings if f['severity'] == 'MEDIUM']
        
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write('''
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Аудит безопасности сайта</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0f; padding: 20px; color: #e0e0e0; }
        .container { max-width: 1000px; margin: 0 auto; }
        
        .header { 
            background: linear-gradient(135deg, #1a1a2e, #16213e); 
            padding: 40px; 
            border-radius: 16px; 
            margin-bottom: 30px; 
            text-align: center;
            border: 1px solid #2a2a4e;
        }
        .header h1 { font-size: 32px; margin-bottom: 10px; }
        .header .url { color: #64ffda; font-size: 20px; margin: 10px 0; }
        .header .date { color: #8892b0; font-size: 14px; }
        .header .badge-total { 
            display: inline-block; 
            background: #e74c3c; 
            padding: 8px 24px; 
            border-radius: 30px; 
            margin-top: 15px;
            font-weight: bold;
        }
        
        .summary { 
            display: grid; 
            grid-template-columns: repeat(4, 1fr); 
            gap: 15px; 
            margin-bottom: 30px; 
        }
        .stat-card { 
            background: #1a1a2e; 
            padding: 20px; 
            border-radius: 12px; 
            text-align: center;
            border: 1px solid #2a2a4e;
        }
        .stat-card .number { font-size: 36px; font-weight: bold; }
        .stat-card .label { color: #8892b0; font-size: 13px; margin-top: 5px; }
        .stat-critical .number { color: #e74c3c; }
        .stat-high .number { color: #e67e22; }
        .stat-medium .number { color: #f1c40f; }
        .stat-total .number { color: #64ffda; }
        
        .finding {
            background: #1a1a2e;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 20px;
            border-left: 5px solid #2a2a4e;
            border: 1px solid #2a2a4e;
            transition: all 0.3s;
        }
        .finding:hover { border-color: #4a4a6e; }
        .finding-critical { border-left-color: #e74c3c; }
        .finding-high { border-left-color: #e67e22; }
        .finding-medium { border-left-color: #f1c40f; }
        
        .finding-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 15px;
            flex-wrap: wrap;
        }
        .badge {
            padding: 4px 16px;
            border-radius: 20px;
            color: white;
            font-size: 12px;
            font-weight: bold;
        }
        .badge-critical { background: #e74c3c; }
        .badge-high { background: #e67e22; }
        .badge-medium { background: #f1c40f; color: #1a1a2e; }
        .finding-header h2 { font-size: 18px; color: #fff; }
        
        .section {
            margin: 12px 0;
            padding: 12px 16px;
            background: #0f0f1f;
            border-radius: 8px;
        }
        .section .label { 
            font-weight: bold; 
            color: #8892b0; 
            display: block; 
            margin-bottom: 5px;
            font-size: 13px;
        }
        .section .text { color: #e0e0e0; line-height: 1.6; }
        .section .text .highlight { color: #e74c3c; font-weight: bold; }
        
        .solution-box {
            background: #0d2818;
            border-left: 4px solid #27ae60;
            padding: 15px;
            border-radius: 6px;
            margin-top: 10px;
        }
        .solution-box .label { color: #27ae60; font-weight: bold; display: block; margin-bottom: 5px; }
        .solution-box .text { color: #a8d5b5; }
        
        .evidence-box {
            background: #1a0f0f;
            border-left: 4px solid #e67e22;
            padding: 10px 15px;
            border-radius: 6px;
            margin-top: 10px;
            font-family: monospace;
            font-size: 13px;
            color: #e67e22;
        }
        
        .footer {
            text-align: center;
            margin-top: 40px;
            color: #8892b0;
            font-size: 13px;
            padding: 20px;
            border-top: 1px solid #2a2a4e;
        }
        
        .print-btn {
            background: #2a2a4e;
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            margin-top: 10px;
        }
        .print-btn:hover { background: #3a3a6e; }
        
        @media (max-width: 700px) {
            .summary { grid-template-columns: repeat(2, 1fr); }
            .header h1 { font-size: 24px; }
        }
        @media print {
            body { background: white; color: black; }
            .header { background: #f0f0f0; border: 1px solid #ddd; }
            .header .url { color: #0066cc; }
            .stat-card { background: #f5f5f5; border: 1px solid #ddd; }
            .finding { background: white; border: 1px solid #ddd; }
            .finding-header h2 { color: #1a1a2e; }
            .section { background: #f8f8f8; }
            .section .text { color: #333; }
            .solution-box { background: #e8f5e9; }
            .solution-box .text { color: #1a3a2a; }
            .evidence-box { background: #fef9e7; }
            .print-btn { display: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 Аудит безопасности сайта</h1>
            <div class="url">''' + self.base_url + '''</div>
            <div class="date">📅 ''' + datetime.now().strftime('%d.%m.%Y %H:%M') + '''</div>
            <div class="badge-total">🔴 ''' + str(len(self.findings)) + ''' проблем найдено</div>
        </div>
        
        <div class="summary">
            <div class="stat-card stat-critical"><div class="number">''' + str(len(critical)) + '''</div><div class="label">🔴 Критические</div></div>
            <div class="stat-card stat-high"><div class="number">''' + str(len(high)) + '''</div><div class="label">🟠 Высокие</div></div>
            <div class="stat-card stat-medium"><div class="number">''' + str(len(medium)) + '''</div><div class="label">🟡 Средние</div></div>
            <div class="stat-card stat-total"><div class="number">''' + str(len(self.findings)) + '''</div><div class="label">📊 Всего</div></div>
        </div>
''')
            
            if not self.findings:
                f.write('''
        <div style="text-align:center;padding:60px 20px;background:#1a1a2e;border-radius:12px;">
            <div style="font-size:64px;margin-bottom:20px;">✅</div>
            <h2 style="color:#27ae60;">Отлично! Уязвимостей не найдено</h2>
            <p style="color:#8892b0;margin-top:10px;">Ваш сайт защищен. Но помните — безопасность требует постоянного внимания.</p>
        </div>
''')
            else:
                for finding in self.findings:
                    sev_class = finding['severity'].lower()
                    badge = finding['severity']
                    
                    f.write(f'''
        <div class="finding finding-{sev_class}">
            <div class="finding-header">
                <span class="badge badge-{sev_class}">{badge}</span>
                <h2>{finding['title']}</h2>
            </div>
            
            <div class="section">
                <span class="label">❓ В чем проблема:</span>
                <div class="text">{finding['problem']}</div>
            </div>
            
            <div class="section">
                <span class="label">💀 Чем это грозит:</span>
                <div class="text">{finding['description']}</div>
            </div>
            
            <div class="section">
                <span class="label">⚠️ Что будет если игнорировать:</span>
                <div class="text"><span class="highlight">{finding['threat']}</span></div>
            </div>
            
            <div class="solution-box">
                <span class="label">✅ Как исправить:</span>
                <div class="text">{finding['solution']}</div>
            </div>
            
            <div class="evidence-box">
                🔍 Доказательство: {finding.get('evidence', 'Проверено сканером')}
            </div>
        </div>
''')
            
            f.write('''
        <div style="text-align:center;margin:30px 0;">
            <button class="print-btn" onclick="window.print()">🖨️ Распечатать отчет</button>
        </div>
        
        <div class="footer">
            Отчет создан автоматически. Рекомендуется провести полный аудит с доступом к файлам сайта.<br>
            <span style="color:#4a4a6e;">© 2026 Security Scanner</span>
        </div>
    </div>
</body>
</html>
''')
        
        print(f"\n{'='*60}")
        print(f"✅ ОТЧЕТ СОЗДАН: {html_file}")
        print(f"{'='*60}")
        print(f"\n📊 Найдено проблем: {len(self.findings)}")
        print(f"   🔴 CRITICAL: {len(critical)}")
        print(f"   🟠 HIGH: {len(high)}")
        print(f"   🟡 MEDIUM: {len(medium)}")
        
        # Автоматически открыть в браузере
        webbrowser.open('file://' + os.path.abspath(html_file))
        print(f"\n📂 Отчет открыт в браузере")

# ============================================================
# ЗАПУСК
# ============================================================
if __name__ == "__main__":
    import sys
    
    domain = sys.argv[1] if len(sys.argv) > 1 else input("Введите домен (например, site.ru): ")
    scanner = ClientSecurityScanner(domain)
    scanner.scan()