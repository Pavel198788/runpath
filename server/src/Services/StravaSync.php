<?php
declare(strict_types=1);

namespace RunPath\Services;

use RunPath\Container;
use RunPath\Db;
use RunPath\Support\Uuid;

/**
 * Забирает новые активности Strava и кладёт их в documents как записи журнала.
 * Клиент увидит их при следующей синхронизации и покажет источник «Strava».
 */
final class StravaSync
{
    public function __construct(private Container $c)
    {
    }

    public function syncUser(string $userId): void
    {
        if ($userId === '') {
            return;
        }
        $stmt = $this->c->pdo->prepare("SELECT last_sync_at FROM integrations WHERE user_id = ? AND provider = 'strava'");
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        if (!$row) {
            return;
        }
        $client = new StravaClient($this->c);
        $activities = $client->recentActivities($userId, $row['last_sync_at'] ?: null);

        $version = (int) $this->c->pdo->query('SELECT sync_version FROM users WHERE id = ' . $this->c->pdo->quote($userId))->fetchColumn();
        $added = 0;
        foreach ($activities as $activity) {
            $log = $client->toWorkoutLog($activity);
            if ($log === null) {
                continue;
            }
            if ($this->exists($userId, (string) $log['externalId'])) {
                continue;
            }
            $version++;
            $now = gmdate('c');
            $doc = [
                'id' => Uuid::v4(),
                'createdAt' => $now,
                'updatedAt' => $now,
                'deletedAt' => null,
                'syncVersion' => $version,
                'workoutId' => null,
                'date' => $log['date'],
                'type' => $log['type'],
                'source' => 'strava',
                'durationSec' => $log['durationSec'],
                'distanceM' => $log['distanceM'],
                'rpe' => null,
                'feeling' => null,
                'pains' => [],
                'note' => '',
                'completedSegments' => null,
                'startTime' => $log['startTime'],
                'avgHr' => $log['avgHr'],
                'elevationGainM' => $log['elevationGainM'],
                'splits' => [],
                'trackId' => null,
                'externalId' => $log['externalId'],
                'name' => $log['name'],
                'shoeId' => null,
                'hrLoad' => null,
                'timeInZones' => null,
            ];
            $this->c->pdo->prepare('INSERT INTO documents (user_id, collection, id, data, updated_at, deleted_at, sync_version, server_updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                ->execute([$userId, 'workoutLogs', $doc['id'], json_encode($doc, JSON_UNESCAPED_UNICODE), $now, null, $version, Db::now()]);
            $added++;
        }
        if ($added > 0) {
            $this->c->pdo->prepare('UPDATE users SET sync_version = ? WHERE id = ?')->execute([$version, $userId]);
        }
        $this->c->pdo->prepare("UPDATE integrations SET last_sync_at = ? WHERE user_id = ? AND provider = 'strava'")->execute([Db::now(), $userId]);
    }

    private function exists(string $userId, string $externalId): bool
    {
        $stmt = $this->c->pdo->prepare("SELECT 1 FROM documents WHERE user_id = ? AND collection = 'workoutLogs' AND data LIKE ? LIMIT 1");
        $stmt->execute([$userId, '%"externalId":"' . $externalId . '"%']);
        return (bool) $stmt->fetchColumn();
    }
}
