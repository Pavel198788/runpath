<?php
declare(strict_types=1);

namespace RunPath;

use PDO;

/** Единая точка подключения к БД: MySQL на хостинге, SQLite в тестах. Только prepared statements. */
final class Db
{
    private static ?PDO $pdo = null;

    public static function connect(Config $config, string $root): PDO
    {
        if (self::$pdo) {
            return self::$pdo;
        }
        $driver = $config->get('DB_DRIVER', 'mysql');
        if ($driver === 'sqlite') {
            $path = $config->get('DB_SQLITE_PATH', ':memory:');
            if ($path !== ':memory:' && $path[0] !== '/') {
                $path = $root . '/' . $path;
            }
            $pdo = new PDO('sqlite:' . $path);
            $pdo->exec('PRAGMA foreign_keys = ON');
            $pdo->exec('PRAGMA journal_mode = WAL');
        } else {
            $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $config->get('DB_HOST', 'localhost'), $config->get('DB_NAME'));
            $pdo = new PDO($dsn, $config->get('DB_USER'), $config->get('DB_PASS'), [
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4, time_zone = '+00:00'",
            ]);
        }
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
        return self::$pdo = $pdo;
    }

    /** Для тестов: сбросить соединение. */
    public static function reset(): void
    {
        self::$pdo = null;
    }

    public static function now(): string
    {
        return gmdate('Y-m-d H:i:s');
    }
}
