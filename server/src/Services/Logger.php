<?php
declare(strict_types=1);

namespace RunPath\Services;

use Psr\Log\AbstractLogger;

/** Логи в файл (storage/logs), без вывода стека наружу. */
final class Logger extends AbstractLogger
{
    public function __construct(private string $file)
    {
        @mkdir(dirname($file), 0775, true);
    }

    public function log($level, string|\Stringable $message, array $context = []): void
    {
        $line = sprintf("[%s] %s: %s %s\n", gmdate('c'), strtoupper((string) $level), $message, $context ? json_encode($context, JSON_UNESCAPED_UNICODE) : '');
        @file_put_contents($this->file, $line, FILE_APPEND | LOCK_EX);
    }
}
