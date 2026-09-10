<?php
declare(strict_types=1);

namespace RunPath\Services;

use RunPath\Container;
use RunPath\Db;
use RunPath\Support\Uuid;
use Throwable;

/**
 * Планировщик и исполнитель фоновых заданий (вызывается из cron).
 * Один тик: поставить задания по расписанию → выполнить пачку → почистить старое.
 * Ограничение по времени, чтобы уложиться в max_execution_time хостинга.
 */
final class JobRunner
{
    private const BATCH = 20;
    private const TIME_BUDGET_SEC = 25;
    private const MAX_ATTEMPTS = 5;

    public function __construct(private Container $c)
    {
    }

    /** @return array<string, mixed> */
    public function tick(): array
    {
        $started = microtime(true);
        $scheduled = $this->schedule();
        $done = 0;
        $failed = 0;

        foreach ($this->claim() as $job) {
            if (microtime(true) - $started > self::TIME_BUDGET_SEC) {
                break;
            }
            try {
                $this->run($job);
                $this->c->pdo->prepare('UPDATE jobs SET done_at = ? WHERE id = ?')->execute([Db::now(), $job['id']]);
                $done++;
            } catch (Throwable $e) {
                $failed++;
                $this->c->logger()->error('job failed', ['kind' => $job['kind'], 'err' => $e->getMessage()]);
                $attempts = (int) $job['attempts'] + 1;
                // Повтор с задержкой; после пяти попыток задание закрывается.
                $this->c->pdo->prepare('UPDATE jobs SET attempts = ?, locked_at = NULL, last_error = ?, run_after = ?, done_at = ? WHERE id = ?')
                    ->execute([$attempts, mb_substr($e->getMessage(), 0, 500), gmdate('Y-m-d H:i:s', time() + 60 * $attempts), $attempts >= self::MAX_ATTEMPTS ? Db::now() : null, $job['id']]);
            }
        }
        $this->cleanup();
        return ['scheduled' => $scheduled, 'done' => $done, 'failed' => $failed, 'seconds' => round(microtime(true) - $started, 2)];
    }

    /** Ставит периодические задания: напоминания по времени пользователя, опрос Strava, еженедельный отчёт. */
    private function schedule(): int
    {
        $count = 0;
        $now = time();
        $nowUtcMinutes = (int) gmdate('H') * 60 + (int) gmdate('i');
        $today = gmdate('Y-m-d');

        // Напоминания: у каждой подписки своё время и часовой пояс.
        $subs = $this->c->pdo->query("SELECT id, user_id, reminder_time, timezone_offset, types, last_sent_day FROM push_subscriptions WHERE types LIKE '%reminder%' AND failures < 5")->fetchAll();
        foreach ($subs as $s) {
            [$h, $m] = array_map('intval', explode(':', (string) $s['reminder_time']));
            // timezone_offset — минуты, которые нужно прибавить к UTC, чтобы получить местное время.
            $localMinutes = ($nowUtcMinutes + (int) $s['timezone_offset'] + 1440) % 1440;
            $target = $h * 60 + $m;
            if ($s['last_sent_day'] === $today || abs($localMinutes - $target) > 5) {
                continue;
            }
            $this->enqueue('push_reminder', ['subscriptionId' => $s['id'], 'userId' => $s['user_id'], 'type' => 'reminder']);
            $this->c->pdo->prepare('UPDATE push_subscriptions SET last_sent_day = ? WHERE id = ?')->execute([$today, $s['id']]);
            $count++;
        }

        // Опрос Strava раз в 15 минут для тех, кого давно не синхронизировали.
        if ((int) gmdate('i') % 15 === 0) {
            $rows = $this->c->pdo->prepare("SELECT user_id FROM integrations WHERE provider = 'strava' AND (last_sync_at IS NULL OR last_sync_at < ?) LIMIT 50");
            $rows->execute([gmdate('Y-m-d H:i:s', $now - 900)]);
            foreach ($rows->fetchAll() as $r) {
                $this->enqueue('strava_sync', ['userId' => $r['user_id']]);
                $count++;
            }
        }
        return $count;
    }

    /** @return array<int, array<string, mixed>> */
    private function claim(): array
    {
        $lockId = Uuid::v4();
        // Помечаем пачку заданий «взято» — так параллельные cron-запуски не сделают работу дважды.
        $this->c->pdo->prepare('UPDATE jobs SET locked_at = ?, last_error = ? WHERE done_at IS NULL AND (locked_at IS NULL OR locked_at < ?) AND run_after <= ? LIMIT ' . self::BATCH)
            ->execute([Db::now(), $lockId, gmdate('Y-m-d H:i:s', time() - 300), Db::now()]);
        $stmt = $this->c->pdo->prepare('SELECT id, kind, payload, attempts FROM jobs WHERE last_error = ? AND done_at IS NULL');
        $stmt->execute([$lockId]);
        return $stmt->fetchAll();
    }

    private function run(array $job): void
    {
        $payload = json_decode((string) $job['payload'], true) ?: [];
        match ($job['kind']) {
            'push_reminder' => (new PushSender($this->c))->sendReminder($payload),
            'strava_sync' => (new StravaSync($this->c))->syncUser((string) ($payload['userId'] ?? '')),
            default => $this->c->logger()->warning('unknown job kind', ['kind' => $job['kind']]),
        };
    }

    private function enqueue(string $kind, array $payload): void
    {
        $this->c->pdo->prepare('INSERT INTO jobs (id, kind, payload, run_after, created_at) VALUES (?, ?, ?, ?, ?)')
            ->execute([Uuid::v4(), $kind, json_encode($payload, JSON_UNESCAPED_UNICODE), Db::now(), Db::now()]);
    }

    private function cleanup(): void
    {
        if (random_int(1, 20) !== 1) {
            return;
        }
        $weekAgo = gmdate('Y-m-d H:i:s', time() - 7 * 86400);
        $this->c->pdo->prepare('DELETE FROM jobs WHERE done_at IS NOT NULL AND done_at < ?')->execute([$weekAgo]);
        $this->c->pdo->prepare('DELETE FROM refresh_tokens WHERE expires_at < ?')->execute([Db::now()]);
        $this->c->pdo->prepare('DELETE FROM user_tokens WHERE expires_at < ?')->execute([Db::now()]);
    }
}
