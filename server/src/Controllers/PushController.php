<?php
declare(strict_types=1);

namespace RunPath\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use RunPath\Container;
use RunPath\Db;
use RunPath\Http\Json;
use RunPath\Support\Uuid;

/** Подписки Web Push. Рассылка идёт из cron, здесь только регистрация. */
final class PushController
{
    public function __construct(private Container $c)
    {
    }

    public function publicKey(Request $request, Response $response): Response
    {
        return Json::ok($response, ['publicKey' => $this->c->config->get('VAPID_PUBLIC_KEY')]);
    }

    public function subscribe(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $body = Json::body($request);
        $sub = $body['subscription'] ?? null;
        if (!is_array($sub) || !isset($sub['endpoint'], $sub['keys']['p256dh'], $sub['keys']['auth'])) {
            return Json::error($response, 'invalid_subscription', 'Некорректная подписка');
        }
        $endpoint = (string) $sub['endpoint'];
        $hash = hash('sha256', $endpoint);
        $types = is_array($body['types'] ?? null) ? implode(',', array_map('strval', $body['types'])) : 'reminder,evening,weekly';
        $time = preg_match('/^\d{2}:\d{2}$/', (string) ($body['reminderTime'] ?? '')) ? (string) $body['reminderTime'] : '18:00';
        $offset = (int) ($body['timezoneOffset'] ?? 0);

        $stmt = $this->c->pdo->prepare('SELECT id FROM push_subscriptions WHERE endpoint_hash = ?');
        $stmt->execute([$hash]);
        $id = $stmt->fetchColumn();
        if ($id) {
            $this->c->pdo->prepare('UPDATE push_subscriptions SET user_id = ?, types = ?, reminder_time = ?, timezone_offset = ?, failures = 0 WHERE id = ?')
                ->execute([$user['id'], $types, $time, $offset, $id]);
        } else {
            $this->c->pdo->prepare('INSERT INTO push_subscriptions (id, user_id, endpoint, endpoint_hash, p256dh, auth, types, reminder_time, timezone_offset, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                ->execute([Uuid::v4(), $user['id'], $endpoint, $hash, (string) $sub['keys']['p256dh'], (string) $sub['keys']['auth'], $types, $time, $offset, Db::now()]);
        }
        return Json::ok($response, ['ok' => true]);
    }

    public function unsubscribe(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $body = Json::body($request);
        $endpoint = Json::str($request, $body, 'endpoint', 500, false);
        if ($endpoint !== '') {
            $this->c->pdo->prepare('DELETE FROM push_subscriptions WHERE endpoint_hash = ? AND user_id = ?')->execute([hash('sha256', $endpoint), $user['id']]);
        } else {
            $this->c->pdo->prepare('DELETE FROM push_subscriptions WHERE user_id = ?')->execute([$user['id']]);
        }
        return Json::ok($response, ['ok' => true]);
    }
}
