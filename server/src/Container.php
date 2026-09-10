<?php
declare(strict_types=1);

namespace RunPath;

use PDO;
use RunPath\Services\Jwt;
use RunPath\Services\Logger;
use RunPath\Services\Mailer;
use RunPath\Services\RateLimiter;
use RunPath\Services\Settings;

/** Простой контейнер зависимостей — без магии, чтобы код читался. */
final class Container
{
    private ?Logger $logger = null;
    private ?Jwt $jwt = null;
    private ?Settings $settings = null;

    public function __construct(
        public readonly Config $config,
        public readonly PDO $pdo,
        public readonly string $root,
    ) {
    }

    public function logger(): Logger
    {
        return $this->logger ??= new Logger($this->root . '/storage/logs/app.log');
    }

    public function jwt(): Jwt
    {
        return $this->jwt ??= new Jwt($this->config->get('APP_KEY', 'dev-key-change-me-please-0123456789'));
    }

    public function settings(): Settings
    {
        return $this->settings ??= new Settings($this->pdo, $this->config);
    }

    public function rateLimiter(): RateLimiter
    {
        return new RateLimiter($this->pdo);
    }

    public function mailer(): Mailer
    {
        return new Mailer($this->config, $this->logger());
    }
}
