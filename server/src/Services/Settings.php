<?php
declare(strict_types=1);

namespace RunPath\Services;

use PDO;
use RunPath\Config;

/** Настройки сервиса (квоты ИИ, флаги фич, тексты push) — в БД, редактируются в админке; дефолты из .env. */
final class Settings
{
    /** @var array<string, mixed>|null */
    private ?array $cache = null;

    public function __construct(private PDO $pdo, private Config $config)
    {
    }

    /** @return array<string, mixed> */
    public function all(): array
    {
        if ($this->cache !== null) {
            return $this->cache;
        }
        $defaults = [
            'ai_daily_messages_per_user' => $this->config->int('AI_DAILY_MESSAGES_PER_USER', 20),
            'ai_guest_daily_messages' => $this->config->int('AI_GUEST_DAILY_MESSAGES', 3),
            'ai_monthly_budget_usd' => (float) $this->config->get('AI_MONTHLY_BUDGET_USD', '50'),
            'ai_model' => $this->config->get('AI_MODEL', 'claude-sonnet-5'),
            'ai_max_context_chars' => 24000,
            'features' => ['ai' => true, 'push' => true, 'strava' => true, 'sync' => true],
            'push_texts' => [
                'reminder' => 'Сегодня по плану: {title}, ≈ {minutes} мин.',
                'evening' => 'Сегодня тренировки ещё не было. Даже 20 минут ходьбы — уже хорошо.',
                'weekly' => 'Итоги недели готовы — загляни в «Прогресс».',
            ],
        ];
        $rows = $this->pdo->query('SELECT `key`, value FROM settings')->fetchAll();
        foreach ($rows as $r) {
            $defaults[$r['key']] = json_decode((string) $r['value'], true);
        }
        return $this->cache = $defaults;
    }

    public function get(string $key, mixed $default = null): mixed
    {
        return $this->all()[$key] ?? $default;
    }

    public function set(string $key, mixed $value): void
    {
        $json = json_encode($value, JSON_UNESCAPED_UNICODE);
        $stmt = $this->pdo->prepare('SELECT 1 FROM settings WHERE `key` = ?');
        $stmt->execute([$key]);
        if ($stmt->fetchColumn()) {
            $this->pdo->prepare('UPDATE settings SET value = ?, updated_at = ? WHERE `key` = ?')->execute([$json, gmdate('Y-m-d H:i:s'), $key]);
        } else {
            $this->pdo->prepare('INSERT INTO settings (`key`, value, updated_at) VALUES (?, ?, ?)')->execute([$key, $json, gmdate('Y-m-d H:i:s')]);
        }
        $this->cache = null;
    }
}
