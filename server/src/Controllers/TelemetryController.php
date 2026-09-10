<?php
declare(strict_types=1);

namespace RunPath\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use RunPath\Container;
use RunPath\Db;
use RunPath\Http\Json;
use RunPath\Support\Uuid;

/**
 * Приватная аналитика без сторонних трекеров: только события приложения и ошибки клиента,
 * и только с явного согласия пользователя (клиент шлёт consent=true).
 */
final class TelemetryController
{
    private const KINDS = ['open', 'phase_reached', 'error', 'workout_done'];

    public function __construct(private Container $c)
    {
    }

    public function collect(Request $request, Response $response): Response
    {
        $body = Json::body($request);
        if (($body['consent'] ?? false) !== true) {
            return Json::ok($response, ['ok' => true, 'stored' => false]);
        }
        $kind = (string) ($body['kind'] ?? '');
        if (!in_array($kind, self::KINDS, true)) {
            return Json::error($response, 'unknown_kind', 'Неизвестный тип события');
        }
        // Персональных данных не храним: только тип, день и короткая полезная нагрузка.
        $payload = json_encode(array_slice((array) ($body['payload'] ?? []), 0, 10), JSON_UNESCAPED_UNICODE);
        $userId = null;
        $header = $request->getHeaderLine('Authorization');
        if (preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
            $claims = $this->c->jwt()->verify($m[1]);
            $userId = $claims['sub'] ?? null;
        }
        $this->c->pdo->prepare('INSERT INTO telemetry (id, user_id, kind, day, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([Uuid::v4(), $userId, $kind, gmdate('Y-m-d'), mb_substr((string) $payload, 0, 2000), Db::now()]);
        return Json::ok($response, ['ok' => true, 'stored' => true]);
    }
}
