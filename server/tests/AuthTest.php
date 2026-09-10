<?php
declare(strict_types=1);

namespace RunPath\Tests;

use RunPath\Services\Mailer;

final class AuthTest extends TestCase
{
    public function testRegisterLoginRefreshFlow(): void
    {
        Mailer::$sent = [];
        $tokens = $this->registerUser();
        self::assertArrayHasKey('accessToken', $tokens);
        self::assertArrayHasKey('refreshToken', $tokens);
        self::assertFalse($tokens['emailVerified']);
        self::assertCount(1, Mailer::$sent, 'должно уйти письмо с подтверждением');

        $me = $this->json($this->request('GET', '/v1/me', null, $tokens['accessToken']));
        self::assertSame('runner@example.com', $me['email']);

        $login = $this->json($this->request('POST', '/v1/auth/login', ['email' => 'runner@example.com', 'password' => 'password123']));
        self::assertArrayHasKey('accessToken', $login);

        $refreshed = $this->json($this->request('POST', '/v1/auth/refresh', ['refreshToken' => $login['refreshToken']]));
        self::assertArrayHasKey('accessToken', $refreshed);

        // Старый refresh-токен после ротации больше не работает.
        $again = $this->request('POST', '/v1/auth/refresh', ['refreshToken' => $login['refreshToken']]);
        self::assertSame(401, $again->getStatusCode());
    }

    public function testWrongPasswordAndDuplicateEmail(): void
    {
        $this->registerUser();
        $bad = $this->request('POST', '/v1/auth/login', ['email' => 'runner@example.com', 'password' => 'wrong-password']);
        self::assertSame(401, $bad->getStatusCode());

        $dup = $this->request('POST', '/v1/auth/register', ['email' => 'runner@example.com', 'password' => 'password123']);
        self::assertSame(409, $dup->getStatusCode());

        $weak = $this->request('POST', '/v1/auth/register', ['email' => 'other@example.com', 'password' => 'short']);
        self::assertSame(400, $weak->getStatusCode());
    }

    public function testPasswordResetFlow(): void
    {
        Mailer::$sent = [];
        $this->registerUser();
        $this->request('POST', '/v1/auth/forgot', ['email' => 'runner@example.com']);
        $letter = end(Mailer::$sent);
        self::assertNotFalse($letter);
        preg_match('/token=([\w\-]+)/', $letter['body'], $m);
        self::assertNotEmpty($m[1] ?? '');

        $reset = $this->request('POST', '/v1/auth/reset', ['token' => $m[1], 'password' => 'new-password-1']);
        self::assertSame(200, $reset->getStatusCode());

        $login = $this->request('POST', '/v1/auth/login', ['email' => 'runner@example.com', 'password' => 'new-password-1']);
        self::assertSame(200, $login->getStatusCode());

        // Повторное использование токена запрещено.
        $again = $this->request('POST', '/v1/auth/reset', ['token' => $m[1], 'password' => 'another-one-2']);
        self::assertSame(400, $again->getStatusCode());
    }

    public function testProtectedRoutesRequireToken(): void
    {
        self::assertSame(401, $this->request('GET', '/v1/me')->getStatusCode());
        self::assertSame(401, $this->request('GET', '/v1/sync/changes')->getStatusCode());
        self::assertSame(401, $this->request('GET', '/v1/me', null, 'garbage-token')->getStatusCode());
    }

    public function testAccountDeletionRemovesData(): void
    {
        $tokens = $this->registerUser();
        $this->request('POST', '/v1/sync/push', ['documents' => [$this->doc('workoutLogs', 'log-1', '2026-09-01T10:00:00Z')]], $tokens['accessToken']);
        self::assertSame(1, (int) $this->pdo->query('SELECT COUNT(*) FROM documents')->fetchColumn());

        $this->request('DELETE', '/v1/me', null, $tokens['accessToken']);
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM users')->fetchColumn());
        self::assertSame(0, (int) $this->pdo->query('SELECT COUNT(*) FROM documents')->fetchColumn());
    }

    /** @return array<string, mixed> */
    private function doc(string $collection, string $id, string $updatedAt): array
    {
        return ['collection' => $collection, 'id' => $id, 'updatedAt' => $updatedAt, 'deletedAt' => null, 'data' => ['id' => $id, 'note' => 'тест']];
    }
}
