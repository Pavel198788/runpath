<?php
declare(strict_types=1);

namespace RunPath\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use RunPath\Container;
use RunPath\Db;
use RunPath\Http\Json;
use RunPath\Services\AiQuota;
use RunPath\Support\Uuid;

/** Админка: статистика, пользователи, настройки сервиса, контент с версиями. */
final class AdminController
{
    public function __construct(private Container $c)
    {
    }

    public function stats(Request $request, Response $response): Response
    {
        $pdo = $this->c->pdo;
        $today = gmdate('Y-m-d');
        $weekAgo = gmdate('Y-m-d', time() - 7 * 86400);
        $q = fn(string $sql, array $p = []) => (function () use ($pdo, $sql, $p) {
            $s = $pdo->prepare($sql);
            $s->execute($p);
            return $s->fetchColumn();
        })();

        // Воронка: сколько пользователей добрались до каждой фазы (по документам плана).
        $funnel = ['k5' => 0, 'k10' => 0, 'half' => 0, 'marathon' => 0];
        $rows = $pdo->query("SELECT data FROM documents WHERE collection = 'workoutLogs' AND deleted_at IS NULL")->fetchAll();
        $bestByUser = [];
        foreach ($pdo->query("SELECT user_id, data FROM documents WHERE collection = 'workoutLogs' AND deleted_at IS NULL")->fetchAll() as $r) {
            $d = json_decode((string) $r['data'], true);
            $km = (float) (($d['distanceM'] ?? 0) / 1000);
            $bestByUser[$r['user_id']] = max($bestByUser[$r['user_id']] ?? 0, $km);
        }
        foreach ($bestByUser as $km) {
            if ($km >= 5) {
                $funnel['k5']++;
            }
            if ($km >= 10) {
                $funnel['k10']++;
            }
            if ($km >= 21) {
                $funnel['half']++;
            }
            if ($km >= 42) {
                $funnel['marathon']++;
            }
        }

        return Json::ok($response, [
            'users' => (int) $q('SELECT COUNT(*) FROM users WHERE deleted_at IS NULL'),
            'dau' => (int) $q('SELECT COUNT(DISTINCT user_id) FROM telemetry WHERE day = ?', [$today]),
            'wau' => (int) $q('SELECT COUNT(DISTINCT user_id) FROM telemetry WHERE day >= ?', [$weekAgo]),
            'aiMessagesToday' => (int) $q('SELECT COUNT(*) FROM ai_usage WHERE day = ?', [$today]),
            'aiCostMonth' => round((float) $q('SELECT COALESCE(SUM(cost_usd),0) FROM ai_usage WHERE month = ?', [gmdate('Y-m')]), 2),
            'pushSubscriptions' => (int) $q('SELECT COUNT(*) FROM push_subscriptions'),
            'stravaConnected' => (int) $q("SELECT COUNT(*) FROM integrations WHERE provider = 'strava'"),
            'errorsWeek' => (int) $q("SELECT COUNT(*) FROM telemetry WHERE kind = 'error' AND day >= ?", [$weekAgo]),
            'documents' => (int) $q('SELECT COUNT(*) FROM documents'),
            'funnel' => $funnel,
            'jobsPending' => (int) $q('SELECT COUNT(*) FROM jobs WHERE done_at IS NULL'),
        ]);
    }

    public function users(Request $request, Response $response): Response
    {
        $limit = min(200, max(1, (int) ($request->getQueryParams()['limit'] ?? 50)));
        $stmt = $this->c->pdo->query("SELECT id, email, role, email_verified_at, blocked_at, sync_version, created_at FROM users ORDER BY created_at DESC LIMIT {$limit}");
        return Json::ok($response, ['users' => $stmt->fetchAll()]);
    }

    public function blockUser(Request $request, Response $response, array $args): Response
    {
        $body = Json::body($request);
        $blocked = (bool) ($body['blocked'] ?? true);
        $this->c->pdo->prepare('UPDATE users SET blocked_at = ?, updated_at = ? WHERE id = ?')
            ->execute([$blocked ? Db::now() : null, Db::now(), (string) $args['id']]);
        return Json::ok($response, ['ok' => true, 'blocked' => $blocked]);
    }

    public function resetQuota(Request $request, Response $response, array $args): Response
    {
        (new AiQuota($this->c))->resetUser((string) $args['id']);
        return Json::ok($response, ['ok' => true]);
    }

    public function deleteUser(Request $request, Response $response, array $args): Response
    {
        $id = (string) $args['id'];
        $pdo = $this->c->pdo;
        $pdo->beginTransaction();
        foreach (['documents', 'refresh_tokens', 'user_tokens', 'push_subscriptions', 'integrations', 'ai_usage'] as $table) {
            $pdo->prepare("DELETE FROM {$table} WHERE user_id = ?")->execute([$id]);
        }
        $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
        $pdo->commit();
        return Json::ok($response, ['ok' => true]);
    }

    public function getSettings(Request $request, Response $response): Response
    {
        return Json::ok($response, $this->c->settings()->all());
    }

    public function putSettings(Request $request, Response $response): Response
    {
        $body = Json::body($request);
        $allowed = ['ai_daily_messages_per_user', 'ai_guest_daily_messages', 'ai_monthly_budget_usd', 'ai_model', 'ai_max_context_chars', 'features', 'push_texts'];
        foreach ($body as $key => $value) {
            if (in_array($key, $allowed, true)) {
                $this->c->settings()->set((string) $key, $value);
            }
        }
        return Json::ok($response, $this->c->settings()->all());
    }

    /** Черновик новой версии контента. Клиенты его не увидят до публикации. */
    public function putContent(Request $request, Response $response, array $args): Response
    {
        $kind = (string) $args['kind'];
        $body = Json::body($request);
        $stmt = $this->c->pdo->prepare('SELECT COALESCE(MAX(version), 0) FROM content_versions WHERE kind = ?');
        $stmt->execute([$kind]);
        $version = (int) $stmt->fetchColumn() + 1;
        $this->c->pdo->prepare('INSERT INTO content_versions (id, kind, version, data, created_at) VALUES (?, ?, ?, ?, ?)')
            ->execute([Uuid::v4(), $kind, $version, json_encode($body['data'] ?? [], JSON_UNESCAPED_UNICODE), Db::now()]);
        return Json::ok($response, ['kind' => $kind, 'version' => $version, 'published' => false]);
    }

    public function publishContent(Request $request, Response $response, array $args): Response
    {
        $kind = (string) $args['kind'];
        $body = Json::body($request);
        $version = (int) ($body['version'] ?? 0);
        $this->c->pdo->prepare('UPDATE content_versions SET published_at = ? WHERE kind = ? AND version = ?')->execute([Db::now(), $kind, $version]);
        return Json::ok($response, ['ok' => true, 'kind' => $kind, 'version' => $version]);
    }
}
