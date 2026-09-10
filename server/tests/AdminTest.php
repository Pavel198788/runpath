<?php
declare(strict_types=1);

namespace RunPath\Tests;

final class AdminTest extends TestCase
{
    public function testAdminRoutesRequireAdminRole(): void
    {
        $user = $this->registerUser();
        self::assertSame(403, $this->request('GET', '/v1/admin/stats', null, $user['accessToken'])->getStatusCode());

        $admin = $this->makeAdmin();
        $stats = $this->json($this->request('GET', '/v1/admin/stats', null, $admin));
        self::assertArrayHasKey('users', $stats);
        self::assertArrayHasKey('funnel', $stats);
    }

    public function testBlockUserPreventsLogin(): void
    {
        $user = $this->registerUser();
        $userId = $this->pdo->query("SELECT id FROM users WHERE email = 'runner@example.com'")->fetchColumn();
        $admin = $this->makeAdmin();

        $this->request('POST', "/v1/admin/users/{$userId}/block", ['blocked' => true], $admin);
        self::assertSame(403, $this->request('POST', '/v1/auth/login', ['email' => 'runner@example.com', 'password' => 'password123'])->getStatusCode());
        self::assertSame(401, $this->request('GET', '/v1/me', null, $user['accessToken'])->getStatusCode());

        $this->request('POST', "/v1/admin/users/{$userId}/block", ['blocked' => false], $admin);
        self::assertSame(200, $this->request('POST', '/v1/auth/login', ['email' => 'runner@example.com', 'password' => 'password123'])->getStatusCode());
    }

    public function testSettingsAndContentPublishing(): void
    {
        $admin = $this->makeAdmin();
        $this->request('PUT', '/v1/admin/settings', ['ai_daily_messages_per_user' => 42, 'unknown_key' => 'ignored'], $admin);
        $settings = $this->json($this->request('GET', '/v1/admin/settings', null, $admin));
        self::assertSame(42, $settings['ai_daily_messages_per_user']);
        self::assertArrayNotHasKey('unknown_key', $settings);

        $draft = $this->json($this->request('PUT', '/v1/admin/content/lessons', ['data' => [['id' => 'l1', 'title' => 'Урок']]], $admin));
        self::assertSame(1, $draft['version']);

        // До публикации клиент видит пустоту.
        $before = $this->json($this->request('GET', '/v1/content/lessons'));
        self::assertSame(0, $before['version']);

        $this->request('POST', '/v1/admin/content/lessons/publish', ['version' => 1], $admin);
        $after = $this->json($this->request('GET', '/v1/content/lessons'));
        self::assertSame(1, $after['version']);
        self::assertSame('Урок', $after['data'][0]['title']);

        // Если у клиента уже эта версия — данные не пересылаются.
        $cached = $this->json($this->request('GET', '/v1/content/lessons?version=1'));
        self::assertTrue($cached['upToDate']);
    }

    public function testTelemetryRequiresConsent(): void
    {
        $this->request('POST', '/v1/telemetry', ['kind' => 'open', 'consent' => false]);
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM telemetry')->fetchColumn());

        $this->request('POST', '/v1/telemetry', ['kind' => 'open', 'consent' => true, 'payload' => ['screen' => 'today']]);
        self::assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM telemetry')->fetchColumn());
    }

    private function makeAdmin(): string
    {
        $tokens = $this->registerUser('admin@example.com');
        $this->pdo->exec("UPDATE users SET role = 'admin' WHERE email = 'admin@example.com'");
        // Роль в токене не проверяется — она читается из БД, поэтому старый токен уже админский.
        return $tokens['accessToken'];
    }
}
