<?php
declare(strict_types=1);

namespace RunPath\Services;

use PDO;

/** Скользящее окно на таблице rate_limits: одна строка на ключ и окно. */
final class RateLimiter
{
    public function __construct(private PDO $pdo)
    {
    }

    public function allow(string $key, int $limit, int $windowSec): bool
    {
        $window = intdiv(time(), $windowSec) * $windowSec;
        $stmt = $this->pdo->prepare('SELECT count FROM rate_limits WHERE `key` = ? AND window_start = ?');
        $stmt->execute([$key, $window]);
        $count = (int) ($stmt->fetchColumn() ?: 0);
        if ($count >= $limit) {
            return false;
        }
        if ($count === 0) {
            $this->pdo->prepare('INSERT INTO rate_limits (`key`, window_start, count) VALUES (?, ?, 1)')->execute([$key, $window]);
            // Изредка чистим старые окна.
            if (random_int(1, 50) === 1) {
                $this->pdo->prepare('DELETE FROM rate_limits WHERE window_start < ?')->execute([$window - 86400]);
            }
        } else {
            $this->pdo->prepare('UPDATE rate_limits SET count = count + 1 WHERE `key` = ? AND window_start = ?')->execute([$key, $window]);
        }
        return true;
    }
}
