<?php
declare(strict_types=1);

namespace RunPath\Tests;

use PDO;
use PHPUnit\Framework\TestCase as BaseTestCase;
use Psr\Http\Message\ResponseInterface;
use RunPath\Config;
use RunPath\Container;
use RunPath\Db;
use RunPath\Routes;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

/**
 * База для тестов API: приложение на SQLite в памяти, схема создаётся напрямую
 * (Phinx на SQLite в памяти не работает — соединение своё).
 */
abstract class TestCase extends BaseTestCase
{
    protected \Slim\App $app;
    protected PDO $pdo;
    protected Container $container;

    protected function setUp(): void
    {
        Db::reset();
        $root = dirname(__DIR__);
        $config = new Config($root);
        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $this->createSchema();
        $this->container = new Container($config, $this->pdo, $root);

        $app = AppFactory::create();
        $app->addBodyParsingMiddleware();
        $app->addRoutingMiddleware();
        $app->addErrorMiddleware(false, false, false);
        Routes::register($app, $this->container);
        $this->app = $app;
    }

    /** @param array<string, mixed>|null $body */
    protected function request(string $method, string $path, ?array $body = null, ?string $token = null): ResponseInterface
    {
        $request = (new ServerRequestFactory())->createServerRequest($method, $path);
        if ($body !== null) {
            $request = $request->withHeader('Content-Type', 'application/json')->withParsedBody($body);
        }
        if ($token !== null) {
            $request = $request->withHeader('Authorization', 'Bearer ' . $token);
        }
        return $this->app->handle($request);
    }

    /** @return array<string, mixed> */
    protected function json(ResponseInterface $response): array
    {
        $response->getBody()->rewind();
        return json_decode((string) $response->getBody()->getContents(), true) ?? [];
    }

    /** Регистрирует пользователя и возвращает его токены. */
    protected function registerUser(string $email = 'runner@example.com', string $password = 'password123'): array
    {
        return $this->json($this->request('POST', '/v1/auth/register', ['email' => $email, 'password' => $password]));
    }

    private function createSchema(): void
    {
        $sql = <<<'SQL'
CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT, role TEXT DEFAULT 'user',
  email_verified_at TEXT NULL, blocked_at TEXT NULL, sync_version INTEGER DEFAULT 0,
  created_at TEXT, updated_at TEXT, deleted_at TEXT NULL);
CREATE TABLE refresh_tokens (id TEXT PRIMARY KEY, user_id TEXT, token_hash TEXT, expires_at TEXT, revoked_at TEXT NULL, created_at TEXT);
CREATE TABLE user_tokens (id TEXT PRIMARY KEY, user_id TEXT, kind TEXT, token_hash TEXT, expires_at TEXT, used_at TEXT NULL, created_at TEXT);
CREATE TABLE documents (user_id TEXT, collection TEXT, id TEXT, data TEXT, updated_at TEXT, deleted_at TEXT NULL,
  sync_version INTEGER, server_updated_at TEXT, PRIMARY KEY (user_id, collection, id));
CREATE TABLE rate_limits ("key" TEXT, window_start INTEGER, count INTEGER DEFAULT 0, PRIMARY KEY ("key", window_start));
CREATE TABLE settings ("key" TEXT PRIMARY KEY, value TEXT, updated_at TEXT);
CREATE TABLE ai_usage (id TEXT PRIMARY KEY, user_id TEXT NULL, day TEXT, month TEXT, input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0, cost_usd REAL DEFAULT 0, created_at TEXT);
CREATE TABLE push_subscriptions (id TEXT PRIMARY KEY, user_id TEXT, endpoint TEXT, endpoint_hash TEXT UNIQUE,
  p256dh TEXT, auth TEXT, types TEXT DEFAULT 'reminder', reminder_time TEXT DEFAULT '18:00',
  timezone_offset INTEGER DEFAULT 0, last_sent_day TEXT NULL, failures INTEGER DEFAULT 0, created_at TEXT);
CREATE TABLE integrations (id TEXT PRIMARY KEY, user_id TEXT, provider TEXT, external_id TEXT NULL,
  access_token_enc TEXT, refresh_token_enc TEXT, expires_at TEXT NULL, last_sync_at TEXT NULL, created_at TEXT);
CREATE TABLE jobs (id TEXT PRIMARY KEY, kind TEXT, payload TEXT, run_after TEXT, attempts INTEGER DEFAULT 0,
  locked_at TEXT NULL, done_at TEXT NULL, last_error TEXT NULL, created_at TEXT);
CREATE TABLE telemetry (id TEXT PRIMARY KEY, user_id TEXT NULL, kind TEXT, day TEXT, payload TEXT, created_at TEXT);
CREATE TABLE content_versions (id TEXT PRIMARY KEY, kind TEXT, version INTEGER, data TEXT, published_at TEXT NULL, created_at TEXT);
SQL;
        foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
            $this->pdo->exec($statement);
        }
    }
}
