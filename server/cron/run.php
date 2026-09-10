<?php
/**
 * Точка входа для cron хостинга. Запускать раз в 1–5 минут:
 *   php /путь/к/server/cron/run.php
 * или по HTTP: https://домен/api/cron/run.php?token=CRON_TOKEN
 *
 * Долгих процессов на shared-хостинге нет, поэтому вся фоновая работа — короткими пачками:
 * берём задания из таблицы jobs, ставим новые по расписанию, укладываемся в лимит времени.
 */
declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

use RunPath\Config;
use RunPath\Container;
use RunPath\Db;
use RunPath\Services\JobRunner;

$root = dirname(__DIR__);
$config = new Config($root);

if (PHP_SAPI !== 'cli') {
    $token = $config->get('CRON_TOKEN');
    if ($token === '' || ($_GET['token'] ?? '') !== $token) {
        http_response_code(403);
        exit('forbidden');
    }
    header('Content-Type: text/plain; charset=utf-8');
}

$container = new Container($config, Db::connect($config, $root), $root);
$runner = new JobRunner($container);
$result = $runner->tick();
echo json_encode($result, JSON_UNESCAPED_UNICODE), "\n";
