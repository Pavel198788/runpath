<?php
declare(strict_types=1);

namespace RunPath\Controllers;

use PDO;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use RunPath\Container;
use RunPath\Db;
use RunPath\Http\Json;
use RunPath\Support\Uuid;

/**
 * Синхронизация local-first.
 *
 * Протокол:
 *  GET  /sync/changes?since=N  → документы с sync_version > N и текущая версия пользователя.
 *  POST /sync/push {documents} → сервер присваивает новые версии и возвращает конфликты.
 *
 * Разрешение конфликтов — last-write-wins по updatedAt документа (строка ISO, сравнение лексикографическое).
 * Журнал тренировок append-only: у записей разные id, поэтому конфликтов там не бывает.
 */
final class SyncController
{
    /** Коллекции, которые синхронизируются. Треки — отдельная, они большие. */
    private const COLLECTIONS = [
        'profiles', 'settings', 'plans', 'workouts', 'workoutLogs', 'tracks',
        'wellness', 'planAdjustments', 'nutritionDays', 'shoes', 'achievements', 'challenges',
    ];

    private const MAX_DOCS_PER_PUSH = 500;
    private const MAX_DOC_BYTES = 1_500_000;

    public function __construct(private Container $c)
    {
    }

    public function changes(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $since = (int) ($request->getQueryParams()['since'] ?? 0);
        $limit = min(500, max(1, (int) ($request->getQueryParams()['limit'] ?? 300)));

        $stmt = $this->c->pdo->prepare('SELECT collection, id, data, updated_at, deleted_at, sync_version FROM documents WHERE user_id = ? AND sync_version > ? ORDER BY sync_version ASC LIMIT ' . $limit);
        $stmt->execute([$user['id'], $since]);
        $documents = [];
        $maxVersion = $since;
        foreach ($stmt->fetchAll() as $row) {
            $documents[] = [
                'collection' => $row['collection'],
                'id' => $row['id'],
                'data' => json_decode((string) $row['data'], true),
                'updatedAt' => $row['updated_at'],
                'deletedAt' => $row['deleted_at'],
                'syncVersion' => (int) $row['sync_version'],
            ];
            $maxVersion = max($maxVersion, (int) $row['sync_version']);
        }
        $current = (int) $this->c->pdo->query('SELECT sync_version FROM users WHERE id = ' . $this->c->pdo->quote($user['id']))->fetchColumn();
        return Json::ok($response, [
            'documents' => $documents,
            'version' => $maxVersion,
            'serverVersion' => $current,
            'hasMore' => count($documents) === $limit && $maxVersion < $current,
        ]);
    }

    public function push(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $body = Json::body($request);
        $incoming = $body['documents'] ?? [];
        if (!is_array($incoming)) {
            return Json::error($response, 'invalid_body', 'documents должен быть массивом');
        }
        if (count($incoming) > self::MAX_DOCS_PER_PUSH) {
            return Json::error($response, 'too_many', 'За раз можно отправить не больше ' . self::MAX_DOCS_PER_PUSH . ' документов', 413);
        }

        $pdo = $this->c->pdo;
        $pdo->beginTransaction();
        // Блокируем строку пользователя, чтобы версии не пересеклись при параллельных запросах.
        $version = (int) $this->lockUserVersion($user['id']);
        $accepted = [];
        $conflicts = [];

        foreach ($incoming as $doc) {
            $error = $this->validate($doc);
            if ($error !== null) {
                $conflicts[] = ['id' => $doc['id'] ?? null, 'reason' => $error];
                continue;
            }
            $collection = (string) $doc['collection'];
            $id = (string) $doc['id'];
            $updatedAt = (string) $doc['updatedAt'];
            $deletedAt = isset($doc['deletedAt']) && $doc['deletedAt'] !== null ? (string) $doc['deletedAt'] : null;
            $data = json_encode($doc['data'], JSON_UNESCAPED_UNICODE);

            $stmt = $pdo->prepare('SELECT updated_at FROM documents WHERE user_id = ? AND collection = ? AND id = ?');
            $stmt->execute([$user['id'], $collection, $id]);
            $existing = $stmt->fetchColumn();

            if ($existing !== false && (string) $existing > $updatedAt) {
                // На сервере более свежая версия — клиент должен её забрать.
                $conflicts[] = ['id' => $id, 'collection' => $collection, 'reason' => 'stale'];
                continue;
            }
            $version++;
            if ($existing === false) {
                $pdo->prepare('INSERT INTO documents (user_id, collection, id, data, updated_at, deleted_at, sync_version, server_updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                    ->execute([$user['id'], $collection, $id, $data, $updatedAt, $deletedAt, $version, Db::now()]);
            } else {
                $pdo->prepare('UPDATE documents SET data = ?, updated_at = ?, deleted_at = ?, sync_version = ?, server_updated_at = ? WHERE user_id = ? AND collection = ? AND id = ?')
                    ->execute([$data, $updatedAt, $deletedAt, $version, Db::now(), $user['id'], $collection, $id]);
            }
            $accepted[] = ['id' => $id, 'collection' => $collection, 'syncVersion' => $version];
        }

        $pdo->prepare('UPDATE users SET sync_version = ?, updated_at = ? WHERE id = ?')->execute([$version, Db::now(), $user['id']]);
        $pdo->commit();

        return Json::ok($response, ['accepted' => $accepted, 'conflicts' => $conflicts, 'version' => $version]);
    }

    private function lockUserVersion(string $userId): int
    {
        $driver = $this->c->pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        $sql = 'SELECT sync_version FROM users WHERE id = ?' . ($driver === 'mysql' ? ' FOR UPDATE' : '');
        $stmt = $this->c->pdo->prepare($sql);
        $stmt->execute([$userId]);
        return (int) $stmt->fetchColumn();
    }

    /** Возвращает код ошибки или null, если документ корректен. */
    private function validate(mixed $doc): ?string
    {
        if (!is_array($doc)) {
            return 'not_object';
        }
        if (!isset($doc['collection']) || !in_array($doc['collection'], self::COLLECTIONS, true)) {
            return 'unknown_collection';
        }
        if (!isset($doc['id']) || !is_string($doc['id']) || strlen($doc['id']) > 36) {
            return 'bad_id';
        }
        if (!isset($doc['updatedAt']) || !is_string($doc['updatedAt']) || strlen($doc['updatedAt']) > 32) {
            return 'bad_updated_at';
        }
        if (!isset($doc['data']) || !is_array($doc['data'])) {
            return 'bad_data';
        }
        if (strlen(json_encode($doc['data'])) > self::MAX_DOC_BYTES) {
            return 'too_large';
        }
        return null;
    }
}
