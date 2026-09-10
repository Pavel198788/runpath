<?php
declare(strict_types=1);

namespace RunPath\Tests;

use RunPath\Services\AiQuota;

final class AiQuotaTest extends TestCase
{
    public function testDailyLimitBlocksAfterN(): void
    {
        $tokens = $this->registerUser();
        $userId = $this->pdo->query('SELECT id FROM users')->fetchColumn();
        $quota = new AiQuota($this->container);
        $this->container->settings()->set('ai_daily_messages_per_user', 3);

        for ($i = 0; $i < 3; $i++) {
            self::assertTrue($quota->check($userId)['allowed']);
            $quota->record($userId, 1000, 500);
        }
        $blocked = $quota->check($userId);
        self::assertFalse($blocked['allowed']);
        self::assertSame('quota_daily', $blocked['reason']);

        $status = $this->json($this->request('GET', '/v1/ai/quota', null, $tokens['accessToken']));
        self::assertSame(0, $status['remaining']);
        self::assertSame(3, $status['usedToday']);

        // Сброс квоты администратором возвращает доступ.
        $quota->resetUser($userId);
        self::assertTrue($quota->check($userId)['allowed']);
    }

    public function testMonthlyBudgetBlocks(): void
    {
        $this->registerUser();
        $userId = $this->pdo->query('SELECT id FROM users')->fetchColumn();
        $quota = new AiQuota($this->container);
        $this->container->settings()->set('ai_monthly_budget_usd', 0.01);
        $this->container->settings()->set('ai_daily_messages_per_user', 100);

        $quota->record($userId, 1_000_000, 1_000_000); // ≈ 18 долларов
        $result = $quota->check($userId);
        self::assertFalse($result['allowed']);
        self::assertSame('quota_budget', $result['reason']);
    }

    public function testChatWithoutApiKeyReturnsClearError(): void
    {
        $tokens = $this->registerUser();
        $response = $this->request('POST', '/v1/ai/chat', ['messages' => [['role' => 'user', 'content' => 'привет']]], $tokens['accessToken']);
        self::assertSame(503, $response->getStatusCode());
        self::assertSame('ai_not_configured', $this->json($response)['error']);
    }
}
