<?php
declare(strict_types=1);

namespace RunPath;

use Dotenv\Dotenv;

/** Читает .env (сначала уровнем выше веб-корня, затем в корне сервера) и отдаёт настройки. */
final class Config
{
    /** @var array<string, string> */
    private array $values = [];

    public function __construct(string $root)
    {
        foreach ([dirname($root), $root] as $dir) {
            if (is_file($dir . '/.env')) {
                Dotenv::createImmutable($dir)->safeLoad();
                break;
            }
        }
        foreach ($_ENV as $k => $v) {
            $this->values[$k] = (string) $v;
        }
        foreach (getenv() ?: [] as $k => $v) {
            $this->values[$k] ??= (string) $v;
        }
    }

    public function get(string $key, string $default = ''): string
    {
        $v = $this->values[$key] ?? $default;
        return $v === '' ? $default : $v;
    }

    public function int(string $key, int $default): int
    {
        $v = $this->get($key);
        return $v === '' ? $default : (int) $v;
    }

    /** @return string[] */
    public function list(string $key): array
    {
        return array_values(array_filter(array_map('trim', explode(',', $this->get($key)))));
    }

    public function isTesting(): bool
    {
        return $this->get('APP_ENV') === 'testing';
    }
}
