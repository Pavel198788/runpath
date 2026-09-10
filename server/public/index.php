<?php
/**
 * Точка входа API. На хостинге веб-корень указывает сюда (или в /api через .htaccess).
 * Все маршруты — в src/routes.php.
 */
declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

$app = RunPath\Bootstrap::create(dirname(__DIR__));
$app->run();
