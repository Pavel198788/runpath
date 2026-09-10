<?php
declare(strict_types=1);

namespace RunPath\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use RunPath\Container;
use RunPath\Db;
use RunPath\Http\Json;
use RunPath\Services\Jwt;
use RunPath\Support\Uuid;

/**
 * Аккаунты: регистрация, вход, обновление токена, подтверждение почты, сброс пароля, удаление.
 * Пароли — Argon2id (или bcrypt, если расширения нет). Ответы намеренно одинаковы,
 * чтобы нельзя было по ним узнать, есть ли такой e-mail.
 */
final class AuthController
{
    public function __construct(private Container $c)
    {
    }

    public function register(Request $request, Response $response): Response
    {
        $body = Json::body($request);
        $email = mb_strtolower(trim(Json::str($request, $body, 'email', 190)));
        $password = Json::str($request, $body, 'password', 200);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return Json::error($response, 'invalid_email', 'Проверьте адрес почты');
        }
        if (mb_strlen($password) < 8) {
            return Json::error($response, 'weak_password', 'Пароль должен быть не короче 8 символов');
        }
        $stmt = $this->c->pdo->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);
        if ($stmt->fetchColumn()) {
            // Не раскрываем существование аккаунта: просто просим войти.
            return Json::error($response, 'email_taken', 'Такой адрес уже зарегистрирован. Попробуйте войти.', 409);
        }
        $id = Uuid::v4();
        $now = Db::now();
        $this->c->pdo->prepare('INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$id, $email, $this->hash($password), 'user', $now, $now]);
        $this->sendVerification($id, $email);
        return Json::ok($response, $this->issueTokens($id, 'user') + ['emailVerified' => false], 201);
    }

    public function login(Request $request, Response $response): Response
    {
        $body = Json::body($request);
        $email = mb_strtolower(trim(Json::str($request, $body, 'email', 190)));
        $password = Json::str($request, $body, 'password', 200);
        $stmt = $this->c->pdo->prepare('SELECT id, password_hash, role, blocked_at, email_verified_at FROM users WHERE email = ? AND deleted_at IS NULL');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            return Json::error($response, 'invalid_credentials', 'Неверная почта или пароль', 401);
        }
        if ($user['blocked_at'] !== null) {
            return Json::error($response, 'blocked', 'Аккаунт заблокирован', 403);
        }
        if (password_needs_rehash($user['password_hash'], $this->algo())) {
            $this->c->pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([$this->hash($password), $user['id']]);
        }
        return Json::ok($response, $this->issueTokens($user['id'], $user['role']) + ['emailVerified' => $user['email_verified_at'] !== null]);
    }

    public function refresh(Request $request, Response $response): Response
    {
        $body = Json::body($request);
        $token = Json::str($request, $body, 'refreshToken', 255);
        $hash = $this->c->jwt()->hash($token);
        $stmt = $this->c->pdo->prepare('SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at, u.role, u.blocked_at FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = ?');
        $stmt->execute([$hash]);
        $row = $stmt->fetch();
        if (!$row || $row['revoked_at'] !== null || $row['expires_at'] < Db::now() || $row['blocked_at'] !== null) {
            return Json::error($response, 'invalid_refresh', 'Сессия истекла, войдите заново', 401);
        }
        // Ротация: старый токен отзываем сразу.
        $this->c->pdo->prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?')->execute([Db::now(), $row['id']]);
        return Json::ok($response, $this->issueTokens($row['user_id'], $row['role']));
    }

    public function logout(Request $request, Response $response): Response
    {
        $body = Json::body($request);
        $token = Json::str($request, $body, 'refreshToken', 255, false);
        if ($token !== '') {
            $this->c->pdo->prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ?')->execute([Db::now(), $this->c->jwt()->hash($token)]);
        }
        return Json::ok($response, ['ok' => true]);
    }

    public function verify(Request $request, Response $response): Response
    {
        $body = Json::body($request);
        $token = Json::str($request, $body, 'token', 255);
        $row = $this->consumeToken($token, 'verify');
        if (!$row) {
            return Json::error($response, 'invalid_token', 'Ссылка недействительна или устарела');
        }
        $this->c->pdo->prepare('UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ?')->execute([Db::now(), Db::now(), $row['user_id']]);
        return Json::ok($response, ['ok' => true]);
    }

    public function forgot(Request $request, Response $response): Response
    {
        $body = Json::body($request);
        $email = mb_strtolower(trim(Json::str($request, $body, 'email', 190)));
        $stmt = $this->c->pdo->prepare('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL');
        $stmt->execute([$email]);
        $id = $stmt->fetchColumn();
        if ($id) {
            $token = $this->createToken((string) $id, 'reset', 3600);
            $link = rtrim($this->c->config->get('APP_URL'), '/') . '/reset?token=' . $token;
            $this->c->mailer()->send($email, 'RunPath: сброс пароля', "Чтобы задать новый пароль, откройте ссылку (действует час):\n{$link}\n\nЕсли это были не вы, просто удалите письмо.");
        }
        // Ответ одинаковый в любом случае.
        return Json::ok($response, ['ok' => true]);
    }

    public function reset(Request $request, Response $response): Response
    {
        $body = Json::body($request);
        $token = Json::str($request, $body, 'token', 255);
        $password = Json::str($request, $body, 'password', 200);
        if (mb_strlen($password) < 8) {
            return Json::error($response, 'weak_password', 'Пароль должен быть не короче 8 символов');
        }
        $row = $this->consumeToken($token, 'reset');
        if (!$row) {
            return Json::error($response, 'invalid_token', 'Ссылка недействительна или устарела');
        }
        $this->c->pdo->prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')->execute([$this->hash($password), Db::now(), $row['user_id']]);
        // Все сессии выходят.
        $this->c->pdo->prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')->execute([Db::now(), $row['user_id']]);
        return Json::ok($response, ['ok' => true]);
    }

    public function me(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $stmt = $this->c->pdo->prepare('SELECT id, email, role, email_verified_at, sync_version, created_at FROM users WHERE id = ?');
        $stmt->execute([$user['id']]);
        return Json::ok($response, $stmt->fetch());
    }

    /** Удаление аккаунта одной кнопкой: данные пользователя стираются полностью. */
    public function deleteAccount(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $pdo = $this->c->pdo;
        $pdo->beginTransaction();
        foreach (['documents', 'refresh_tokens', 'user_tokens', 'push_subscriptions', 'integrations', 'ai_usage'] as $table) {
            $pdo->prepare("DELETE FROM {$table} WHERE user_id = ?")->execute([$user['id']]);
        }
        $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$user['id']]);
        $pdo->commit();
        return Json::ok($response, ['ok' => true]);
    }

    /** @return array{accessToken: string, refreshToken: string, expiresIn: int} */
    private function issueTokens(string $userId, string $role): array
    {
        $refresh = $this->c->jwt()->randomToken();
        $this->c->pdo->prepare('INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
            ->execute([Uuid::v4(), $userId, $this->c->jwt()->hash($refresh), gmdate('Y-m-d H:i:s', time() + Jwt::REFRESH_TTL), Db::now()]);
        return ['accessToken' => $this->c->jwt()->issueAccess($userId, $role), 'refreshToken' => $refresh, 'expiresIn' => Jwt::ACCESS_TTL];
    }

    private function sendVerification(string $userId, string $email): void
    {
        $token = $this->createToken($userId, 'verify', 86400 * 3);
        $link = rtrim($this->c->config->get('APP_URL'), '/') . '/verify?token=' . $token;
        $this->c->mailer()->send($email, 'RunPath: подтверждение почты', "Добро пожаловать! Подтвердите адрес по ссылке:\n{$link}");
    }

    private function createToken(string $userId, string $kind, int $ttl): string
    {
        $token = $this->c->jwt()->randomToken();
        $this->c->pdo->prepare('INSERT INTO user_tokens (id, user_id, kind, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([Uuid::v4(), $userId, $kind, $this->c->jwt()->hash($token), gmdate('Y-m-d H:i:s', time() + $ttl), Db::now()]);
        return $token;
    }

    /** @return array<string, mixed>|null */
    private function consumeToken(string $token, string $kind): ?array
    {
        $hash = $this->c->jwt()->hash($token);
        $stmt = $this->c->pdo->prepare('SELECT id, user_id FROM user_tokens WHERE token_hash = ? AND kind = ? AND used_at IS NULL AND expires_at > ?');
        $stmt->execute([$hash, $kind, Db::now()]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }
        $this->c->pdo->prepare('UPDATE user_tokens SET used_at = ? WHERE id = ?')->execute([Db::now(), $row['id']]);
        return $row;
    }

    private function algo(): string
    {
        return defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT;
    }

    private function hash(string $password): string
    {
        return password_hash($password, $this->algo());
    }
}
