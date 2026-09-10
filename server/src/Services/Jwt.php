<?php
declare(strict_types=1);

namespace RunPath\Services;

use Firebase\JWT\JWT as FirebaseJwt;
use Firebase\JWT\Key;
use Throwable;

/**
 * Access-токен — короткий JWT (15 минут), refresh — случайная строка, хэш в БД, ротация при каждом обновлении.
 * Оба живут в хранилище PWA (не в cookie): PWA и API на разных доменах, cookie там ненадёжны, а CSRF без cookie не нужен.
 */
final class Jwt
{
    public const ACCESS_TTL = 900;
    public const REFRESH_TTL = 60 * 60 * 24 * 30;

    public function __construct(private string $secret)
    {
    }

    public function issueAccess(string $userId, string $role): string
    {
        $now = time();
        return FirebaseJwt::encode(['sub' => $userId, 'role' => $role, 'typ' => 'access', 'iat' => $now, 'exp' => $now + self::ACCESS_TTL], $this->secret, 'HS256');
    }

    /** @return array<string, mixed>|null */
    public function verify(string $token): ?array
    {
        try {
            return (array) FirebaseJwt::decode($token, new Key($this->secret, 'HS256'));
        } catch (Throwable) {
            return null;
        }
    }

    public function randomToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    public function hash(string $token): string
    {
        return hash_hmac('sha256', $token, $this->secret);
    }

    /** Подписанное состояние для OAuth (Strava): user id + срок. */
    public function signState(string $userId): string
    {
        return FirebaseJwt::encode(['sub' => $userId, 'typ' => 'state', 'exp' => time() + 600], $this->secret, 'HS256');
    }
}
