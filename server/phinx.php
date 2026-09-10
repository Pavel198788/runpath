<?php
/** Конфигурация миграций Phinx. Читает те же переменные, что и приложение. */
require __DIR__ . '/vendor/autoload.php';

$config = new RunPath\Config(__DIR__);
$driver = $config->get('DB_DRIVER', 'mysql');
$sqlitePath = $config->get('DB_SQLITE_PATH', 'storage/runpath.sqlite');
if ($sqlitePath !== ':memory:' && $sqlitePath[0] !== '/') {
    $sqlitePath = __DIR__ . '/' . $sqlitePath;
}

$env = $driver === 'sqlite'
    ? ['adapter' => 'sqlite', 'name' => preg_replace('/\.sqlite$/', '', $sqlitePath), 'suffix' => '.sqlite']
    : ['adapter' => 'mysql', 'host' => $config->get('DB_HOST', 'localhost'), 'name' => $config->get('DB_NAME'), 'user' => $config->get('DB_USER'), 'pass' => $config->get('DB_PASS'), 'charset' => 'utf8mb4', 'collation' => 'utf8mb4_unicode_ci'];

return [
    'paths' => ['migrations' => __DIR__ . '/migrations'],
    'environments' => [
        'default_migration_table' => 'phinxlog',
        'default_environment' => 'production',
        'production' => $env,
        'testing' => ['adapter' => 'sqlite', 'name' => __DIR__ . '/storage/test', 'suffix' => '.sqlite'],
    ],
];
