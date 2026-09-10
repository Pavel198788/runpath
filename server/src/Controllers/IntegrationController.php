<?php
declare(strict_types=1);

namespace RunPath\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use RunPath\Container;
use RunPath\Db;
use RunPath\Http\Json;
use RunPath\Services\StravaClient;
use RunPath\Support\Crypto;
use RunPath\Support\Uuid;

/**
 * Strava OAuth: одно приложение на весь сервис, токены пользователей в БД (зашифрованы).
 * Новые пробежки забираются из cron (опрос) или по webhook, если хостинг его принимает.
 * Garmin: интерфейс тот же, реализация — после одобрения заявки разработчика (см. docs).
 */
final class IntegrationController
{
    public function __construct(private Container $c)
    {
    }

    public function list(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $stmt = $this->c->pdo->prepare('SELECT provider, external_id, last_sync_at, created_at FROM integrations WHERE user_id = ?');
        $stmt->execute([$user['id']]);
        return Json::ok($response, ['integrations' => $stmt->fetchAll(), 'available' => ['strava' => $this->c->config->get('STRAVA_CLIENT_ID') !== '', 'garmin' => false]]);
    }

    /** Отдаёт ссылку на страницу разрешения Strava. State подписан, чтобы никто не привязал чужой аккаунт. */
    public function stravaAuthorize(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $clientId = $this->c->config->get('STRAVA_CLIENT_ID');
        if ($clientId === '') {
            return Json::error($response, 'not_configured', 'Strava не настроена на сервере', 503);
        }
        $redirect = rtrim($this->c->config->get('APP_URL'), '/') . '/api/v1/integrations/strava/callback';
        $url = 'https://www.strava.com/oauth/authorize?' . http_build_query([
            'client_id' => $clientId,
            'redirect_uri' => $redirect,
            'response_type' => 'code',
            'approval_prompt' => 'auto',
            'scope' => 'read,activity:read_all',
            'state' => $this->c->jwt()->signState($user['id']),
        ]);
        return Json::ok($response, ['url' => $url]);
    }

    /** Callback от Strava: меняем код на токены и возвращаем пользователя в приложение. */
    public function stravaCallback(Request $request, Response $response): Response
    {
        $query = $request->getQueryParams();
        $client = rtrim($this->c->config->list('CLIENT_ORIGINS')[0] ?? $this->c->config->get('APP_URL'), '/');
        $state = $this->c->jwt()->verify((string) ($query['state'] ?? ''));
        if (!$state || ($state['typ'] ?? '') !== 'state' || !isset($query['code'])) {
            return $response->withHeader('Location', $client . '/#/more?strava=error')->withStatus(302);
        }
        $strava = new StravaClient($this->c);
        $tokens = $strava->exchangeCode((string) $query['code']);
        if ($tokens === null) {
            return $response->withHeader('Location', $client . '/#/more?strava=error')->withStatus(302);
        }
        $crypto = new Crypto($this->c->config->get('APP_KEY'));
        $userId = (string) $state['sub'];
        $this->c->pdo->prepare('DELETE FROM integrations WHERE user_id = ? AND provider = ?')->execute([$userId, 'strava']);
        $this->c->pdo->prepare('INSERT INTO integrations (id, user_id, provider, external_id, access_token_enc, refresh_token_enc, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([Uuid::v4(), $userId, 'strava', $tokens['athleteId'], $crypto->encrypt($tokens['access']), $crypto->encrypt($tokens['refresh']), gmdate('Y-m-d H:i:s', $tokens['expiresAt']), Db::now()]);
        // Сразу ставим задание на первую загрузку тренировок.
        $this->c->pdo->prepare('INSERT INTO jobs (id, kind, payload, run_after, created_at) VALUES (?, ?, ?, ?, ?)')
            ->execute([Uuid::v4(), 'strava_sync', json_encode(['userId' => $userId]), Db::now(), Db::now()]);
        return $response->withHeader('Location', $client . '/#/more?strava=ok')->withStatus(302);
    }

    public function disconnect(Request $request, Response $response, array $args): Response
    {
        $user = $request->getAttribute('user');
        $provider = (string) ($args['provider'] ?? '');
        $this->c->pdo->prepare('DELETE FROM integrations WHERE user_id = ? AND provider = ?')->execute([$user['id'], $provider]);
        return Json::ok($response, ['ok' => true]);
    }

    /** Ручная синхронизация: ставим задание, cron заберёт в ближайшую минуту. */
    public function syncNow(Request $request, Response $response, array $args): Response
    {
        $user = $request->getAttribute('user');
        $this->c->pdo->prepare('INSERT INTO jobs (id, kind, payload, run_after, created_at) VALUES (?, ?, ?, ?, ?)')
            ->execute([Uuid::v4(), (string) $args['provider'] . '_sync', json_encode(['userId' => $user['id']]), Db::now(), Db::now()]);
        return Json::ok($response, ['queued' => true]);
    }

    /** Webhook Strava: GET — подтверждение подписки, POST — событие о новой активности. */
    public function stravaWebhook(Request $request, Response $response): Response
    {
        if ($request->getMethod() === 'GET') {
            $q = $request->getQueryParams();
            if (($q['hub_verify_token'] ?? '') !== $this->c->config->get('STRAVA_WEBHOOK_VERIFY_TOKEN')) {
                return Json::error($response, 'forbidden', 'Неверный токен', 403);
            }
            return Json::ok($response, ['hub.challenge' => $q['hub_challenge'] ?? '']);
        }
        $body = Json::body($request);
        if (($body['object_type'] ?? '') === 'activity' && ($body['aspect_type'] ?? '') === 'create') {
            $stmt = $this->c->pdo->prepare('SELECT user_id FROM integrations WHERE provider = ? AND external_id = ?');
            $stmt->execute(['strava', (string) ($body['owner_id'] ?? '')]);
            $userId = $stmt->fetchColumn();
            if ($userId) {
                $this->c->pdo->prepare('INSERT INTO jobs (id, kind, payload, run_after, created_at) VALUES (?, ?, ?, ?, ?)')
                    ->execute([Uuid::v4(), 'strava_sync', json_encode(['userId' => $userId, 'activityId' => $body['object_id'] ?? null]), Db::now(), Db::now()]);
            }
        }
        return Json::ok($response, ['ok' => true]);
    }
}
