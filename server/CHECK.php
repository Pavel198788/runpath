<?php
/**
 * Проверка возможностей хостинга. Открыть в браузере: https://домен/api/CHECK.php
 * (или php CHECK.php в консоли). После проверки файл лучше удалить.
 */
declare(strict_types=1);
header('Content-Type: text/plain; charset=utf-8');

$ok = fn(bool $v) => $v ? 'OK ' : 'НЕТ';
$lines = [];
$lines[] = 'RunPath — проверка хостинга';
$lines[] = str_repeat('=', 40);
$lines[] = sprintf('[%s] PHP %s (нужно ≥ 8.2)', $ok(version_compare(PHP_VERSION, '8.2.0', '>=')), PHP_VERSION);
foreach (['pdo_mysql' => 'БД MySQL', 'openssl' => 'JWT/шифрование', 'curl' => 'Anthropic/Strava API', 'mbstring' => 'строки', 'json' => 'JSON', 'gmp' => 'Web Push (или bcmath)', 'bcmath' => 'Web Push (или gmp)', 'zlib' => 'сжатие треков', 'pdo_sqlite' => 'тесты (необязательно)'] as $ext => $why) {
    $lines[] = sprintf('[%s] расширение %s — %s', $ok(extension_loaded($ext)), $ext, $why);
}
$lines[] = sprintf('[%s] Argon2id для паролей %s', $ok(defined('PASSWORD_ARGON2ID')), defined('PASSWORD_ARGON2ID') ? '' : '(будет bcrypt — тоже допустимо)');
$lines[] = sprintf('[%s] HTTPS %s', $ok((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https' || PHP_SAPI === 'cli'), PHP_SAPI === 'cli' ? '(консоль — не проверяется)' : '');
$lines[] = sprintf('[%s] mod_rewrite / .htaccess %s', $ok(PHP_SAPI === 'cli' || function_exists('apache_get_modules') ? (PHP_SAPI === 'cli' || in_array('mod_rewrite', apache_get_modules(), true)) : true), function_exists('apache_get_modules') ? '' : '(не Apache или не определить — проверьте: /api/v1/health должен отвечать)');
$lines[] = sprintf('[%s] max_execution_time = %s (для SSE-стриминга ИИ желательно ≥ 60)', $ok((int) ini_get('max_execution_time') === 0 || (int) ini_get('max_execution_time') >= 60), ini_get('max_execution_time'));
$lines[] = sprintf('[%s] memory_limit = %s (нужно ≥ 128M)', $ok(toBytes(ini_get('memory_limit')) >= 128 * 1024 * 1024 || (int) ini_get('memory_limit') === -1), ini_get('memory_limit'));
$lines[] = sprintf('[%s] output_buffering = %s (для SSE лучше off; иначе ответы ИИ придут целиком — приложение это умеет)', $ok(!ini_get('output_buffering') || ini_get('output_buffering') === '0'), ini_get('output_buffering') ?: 'off');
$lines[] = sprintf('[%s] allow_url_fopen/curl для исходящих запросов', $ok(function_exists('curl_init')));
$lines[] = sprintf('[%s] запись в storage/ (логи, очередь)', $ok(is_writable(__DIR__ . '/storage') || @mkdir(__DIR__ . '/storage', 0775, true)));
$lines[] = sprintf('[%s] mail() доступна (подтверждение почты) %s', $ok(function_exists('mail')), function_exists('mail') ? '' : '— используйте SMTP в .env');
$lines[] = sprintf('[%s] .env вне веб-корня найден: %s', $ok(file_exists(dirname(__DIR__) . '/.env') || file_exists(__DIR__ . '/.env')), file_exists(dirname(__DIR__) . '/.env') ? dirname(__DIR__) . '/.env' : (file_exists(__DIR__ . '/.env') ? __DIR__ . '/.env (лучше перенести на уровень выше)' : 'нет'));
$lines[] = '';
$lines[] = 'Cron: в панели хостинга добавьте задание раз в 5 минут:';
$lines[] = '  php ' . __DIR__ . '/cron/run.php';
$lines[] = 'или по HTTP: ' . ($_SERVER['HTTP_HOST'] ?? 'https://домен') . '/api/cron/run.php?token=CRON_TOKEN';
$lines[] = '';
$lines[] = 'Что не работает на shared-хостинге и как обойдено: долгоживущих процессов нет (всё через cron),';
$lines[] = 'WebSocket нет (клиент синхронизируется при открытии и по кнопке), SSE — если output_buffering off.';
echo implode("\n", $lines), "\n";

function toBytes(string $v): int
{
    $v = trim($v);
    $n = (int) $v;
    return match (strtolower(substr($v, -1))) { 'g' => $n * 1024 ** 3, 'm' => $n * 1024 ** 2, 'k' => $n * 1024, default => $n };
}
