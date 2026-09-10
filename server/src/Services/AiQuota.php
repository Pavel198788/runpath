<?php
declare(strict_types=1);

namespace RunPath\Services;

use RunPath\Container;
use RunPath\Db;
use RunPath\Support\Uuid;

/**
 * Квоты ИИ: сообщения в день на пользователя и месячный бюджет сервиса в долларах.
 * Цены модели заданы здесь; при смене модели поправить.
 */
final class AiQuota
{
    private const PRICE_INPUT_PER_MTOK = 3.0;
    private const PRICE_OUTPUT_PER_MTOK = 15.0;

    public function __construct(private Container $c)
    {
    }

    /** @return array{allowed: bool, reason: string, message: string} */
    public function check(string $userId): array
    {
        $settings = $this->c->settings();
        $dayLimit = (int) $settings->get('ai_daily_messages_per_user', 20);
        $used = $this->usedToday($userId);
        if ($used >= $dayLimit) {
            return ['allowed' => false, 'reason' => 'quota_daily', 'message' => "Дневной лимит {$dayLimit} сообщений исчерпан. Он обновится завтра."];
        }
        $budget = (float) $settings->get('ai_monthly_budget_usd', 50);
        if ($this->spentThisMonth() >= $budget) {
            return ['allowed' => false, 'reason' => 'quota_budget', 'message' => 'Месячный бюджет сервиса на ИИ исчерпан. Можно подключить свой ключ в настройках.'];
        }
        return ['allowed' => true, 'reason' => '', 'message' => ''];
    }

    public function record(string $userId, int $inputTokens, int $outputTokens): void
    {
        $cost = ($inputTokens / 1_000_000) * self::PRICE_INPUT_PER_MTOK + ($outputTokens / 1_000_000) * self::PRICE_OUTPUT_PER_MTOK;
        $this->c->pdo->prepare('INSERT INTO ai_usage (id, user_id, day, month, input_tokens, output_tokens, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([Uuid::v4(), $userId, gmdate('Y-m-d'), gmdate('Y-m'), $inputTokens, $outputTokens, round($cost, 5), Db::now()]);
    }

    /** @return array<string, mixed> */
    public function status(string $userId): array
    {
        $settings = $this->c->settings();
        $dayLimit = (int) $settings->get('ai_daily_messages_per_user', 20);
        $used = $this->usedToday($userId);
        return [
            'usedToday' => $used,
            'dailyLimit' => $dayLimit,
            'remaining' => max(0, $dayLimit - $used),
            'budgetUsed' => round($this->spentThisMonth(), 2),
            'budgetLimit' => (float) $settings->get('ai_monthly_budget_usd', 50),
        ];
    }

    public function resetUser(string $userId): void
    {
        $this->c->pdo->prepare('DELETE FROM ai_usage WHERE user_id = ? AND day = ?')->execute([$userId, gmdate('Y-m-d')]);
    }

    private function usedToday(string $userId): int
    {
        $stmt = $this->c->pdo->prepare('SELECT COUNT(*) FROM ai_usage WHERE user_id = ? AND day = ?');
        $stmt->execute([$userId, gmdate('Y-m-d')]);
        return (int) $stmt->fetchColumn();
    }

    private function spentThisMonth(): float
    {
        $stmt = $this->c->pdo->prepare('SELECT COALESCE(SUM(cost_usd), 0) FROM ai_usage WHERE month = ?');
        $stmt->execute([gmdate('Y-m')]);
        return (float) $stmt->fetchColumn();
    }
}
