<?php
declare(strict_types=1);

namespace RunPath\Services;

use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use RunPath\Container;

/**
 * Отправка Web Push. Важное ограничение: на iOS push работает только если приложение
 * установлено на домашний экран (iOS 16.4+) — клиент это проверяет и подсказывает установку.
 */
final class PushSender
{
    public function __construct(private Container $c)
    {
    }

    public function sendReminder(array $payload): void
    {
        $stmt = $this->c->pdo->prepare('SELECT * FROM push_subscriptions WHERE id = ?');
        $stmt->execute([$payload['subscriptionId'] ?? '']);
        $sub = $stmt->fetch();
        if (!$sub) {
            return;
        }
        $texts = (array) $this->c->settings()->get('push_texts', []);
        $type = (string) ($payload['type'] ?? 'reminder');
        $body = (string) ($texts[$type] ?? 'Пора на тренировку.');
        // Подставляем данные тренировки, если клиент их синхронизировал.
        $body = strtr($body, ['{title}' => (string) ($payload['title'] ?? 'тренировка'), '{minutes}' => (string) ($payload['minutes'] ?? '30')]);
        $this->send($sub, ['title' => 'RunPath', 'body' => $body, 'tag' => 'runpath-' . $type, 'url' => '/today']);
    }

    private function send(array $sub, array $data): void
    {
        $public = $this->c->config->get('VAPID_PUBLIC_KEY');
        $private = $this->c->config->get('VAPID_PRIVATE_KEY');
        if ($public === '' || $private === '') {
            $this->c->logger()->warning('VAPID keys missing, push skipped');
            return;
        }
        $webPush = new WebPush(['VAPID' => ['subject' => $this->c->config->get('VAPID_SUBJECT', 'mailto:admin@example.com'), 'publicKey' => $public, 'privateKey' => $private]]);
        $subscription = Subscription::create([
            'endpoint' => $sub['endpoint'],
            'publicKey' => $sub['p256dh'],
            'authToken' => $sub['auth'],
        ]);
        $report = $webPush->sendOneNotification($subscription, json_encode($data, JSON_UNESCAPED_UNICODE));
        if (!$report->isSuccess()) {
            $failures = (int) $sub['failures'] + 1;
            // Подписка «протухла» (отписались, переустановили) — удаляем.
            if ($report->isSubscriptionExpired() || $failures >= 5) {
                $this->c->pdo->prepare('DELETE FROM push_subscriptions WHERE id = ?')->execute([$sub['id']]);
            } else {
                $this->c->pdo->prepare('UPDATE push_subscriptions SET failures = ? WHERE id = ?')->execute([$failures, $sub['id']]);
            }
        }
    }
}
