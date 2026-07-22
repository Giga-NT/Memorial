<<<<<<< HEAD
<?php
// send_mail.php - Отправка писем через PHP

header('Content-Type: application/json');

// Получаем данные
$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    echo json_encode(['success' => false, 'error' => 'Нет данных']);
    exit;
}

// Настройки
$to = 'gipsogen2008@gmail.com';
$subject = $data['subject'] ?? 'Новый заказ из Стелы';

// Формируем письмо
$message = "📋 НОВЫЙ ЗАКАЗ\n";
$message .= "=" . str_repeat("=", 40) . "\n\n";

$message .= "👤 КЛИЕНТ:\n";
$message .= "ФИО: " . ($data['client_name'] ?? 'Не указано') . "\n";
$message .= "Телефон: " . ($data['client_phone'] ?? 'Не указано') . "\n";
$message .= "Email: " . ($data['client_email'] ?? 'Не указано') . "\n\n";

$message .= "🗿 ПАРАМЕТРЫ:\n";
$message .= "Режим: " . ($data['mode'] == 'engraving' ? 'Гравировка' : 'Фото-декаль') . "\n";
$message .= "Камень: " . ($data['stone'] ?? 'Классический') . "\n";
$message .= "Форма: " . ($data['shape'] ?? 'Без формы') . "\n";
$message .= "Масштаб: " . ($data['scale'] ?? '0.8') . "\n\n";

$message .= "🎨 ОБРАБОТКА:\n";
$message .= "Глубина: " . ($data['depth'] ?? '0.9') . "\n";
$message .= "Ореол: " . ($data['halo'] ?? '35') . "\n";
$message .= "Контраст: " . ($data['contrast'] ?? '3.0') . "\n";
$message .= "Яркость: " . ($data['brightness'] ?? '0') . "\n\n";

if (!empty($data['notes'])) {
    $message .= "💬 КОММЕНТАРИЙ:\n";
    $message .= $data['notes'] . "\n\n";
}

$message .= "📅 " . date('d.m.Y H:i') . "\n";
$message .= str_repeat("=", 50);

// Заголовки
$headers = "From: stela@localhost\r\n";
$headers .= "Reply-To: " . ($data['client_email'] ?? 'no-reply@stela.ru') . "\r\n";
$headers .= "Content-Type: text/plain; charset=utf-8\r\n";
$headers .= "Content-Transfer-Encoding: 8bit\r\n";

// Отправляем
$result = mail($to, $subject, $message, $headers);

echo json_encode([
    'success' => $result,
    'message' => $result ? 'Письмо отправлено' : 'Ошибка отправки'
=======
<?php
// send_mail.php - Отправка писем через PHP

header('Content-Type: application/json');

// Получаем данные
$data = json_decode(file_get_contents('php://input'), true);

if (!$data) {
    echo json_encode(['success' => false, 'error' => 'Нет данных']);
    exit;
}

// Настройки
$to = 'gipsogen2008@gmail.com';
$subject = $data['subject'] ?? 'Новый заказ из Стелы';

// Формируем письмо
$message = "📋 НОВЫЙ ЗАКАЗ\n";
$message .= "=" . str_repeat("=", 40) . "\n\n";

$message .= "👤 КЛИЕНТ:\n";
$message .= "ФИО: " . ($data['client_name'] ?? 'Не указано') . "\n";
$message .= "Телефон: " . ($data['client_phone'] ?? 'Не указано') . "\n";
$message .= "Email: " . ($data['client_email'] ?? 'Не указано') . "\n\n";

$message .= "🗿 ПАРАМЕТРЫ:\n";
$message .= "Режим: " . ($data['mode'] == 'engraving' ? 'Гравировка' : 'Фото-декаль') . "\n";
$message .= "Камень: " . ($data['stone'] ?? 'Классический') . "\n";
$message .= "Форма: " . ($data['shape'] ?? 'Без формы') . "\n";
$message .= "Масштаб: " . ($data['scale'] ?? '0.8') . "\n\n";

$message .= "🎨 ОБРАБОТКА:\n";
$message .= "Глубина: " . ($data['depth'] ?? '0.9') . "\n";
$message .= "Ореол: " . ($data['halo'] ?? '35') . "\n";
$message .= "Контраст: " . ($data['contrast'] ?? '3.0') . "\n";
$message .= "Яркость: " . ($data['brightness'] ?? '0') . "\n\n";

if (!empty($data['notes'])) {
    $message .= "💬 КОММЕНТАРИЙ:\n";
    $message .= $data['notes'] . "\n\n";
}

$message .= "📅 " . date('d.m.Y H:i') . "\n";
$message .= str_repeat("=", 50);

// Заголовки
$headers = "From: stela@localhost\r\n";
$headers .= "Reply-To: " . ($data['client_email'] ?? 'no-reply@stela.ru') . "\r\n";
$headers .= "Content-Type: text/plain; charset=utf-8\r\n";
$headers .= "Content-Transfer-Encoding: 8bit\r\n";

// Отправляем
$result = mail($to, $subject, $message, $headers);

echo json_encode([
    'success' => $result,
    'message' => $result ? 'Письмо отправлено' : 'Ошибка отправки'
>>>>>>> 8e734ba9ce21e78239c78bba23747082f52e579a
]);