<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

/** ИИ-квоты и расход токенов, push-подписки, интеграции (Strava), очередь заданий для cron, телеметрия. */
final class CreateAiPushIntegrations extends AbstractMigration
{
    public function change(): void
    {
        $this->table('ai_usage', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 36])
            ->addColumn('user_id', 'string', ['limit' => 36, 'null' => true])
            ->addColumn('day', 'string', ['limit' => 10])
            ->addColumn('month', 'string', ['limit' => 7])
            ->addColumn('input_tokens', 'integer', ['default' => 0])
            ->addColumn('output_tokens', 'integer', ['default' => 0])
            ->addColumn('cost_usd', 'decimal', ['precision' => 10, 'scale' => 5, 'default' => 0])
            ->addColumn('created_at', 'datetime')
            ->addIndex(['user_id', 'day'])
            ->addIndex(['month'])
            ->create();

        $this->table('push_subscriptions', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 36])
            ->addColumn('user_id', 'string', ['limit' => 36])
            ->addColumn('endpoint', 'text')
            ->addColumn('endpoint_hash', 'string', ['limit' => 64])
            ->addColumn('p256dh', 'string', ['limit' => 255])
            ->addColumn('auth', 'string', ['limit' => 255])
            ->addColumn('types', 'string', ['limit' => 190, 'default' => 'reminder,evening,weekly'])
            ->addColumn('reminder_time', 'string', ['limit' => 5, 'default' => '18:00'])
            ->addColumn('timezone_offset', 'integer', ['default' => 0])
            ->addColumn('last_sent_day', 'string', ['limit' => 10, 'null' => true])
            ->addColumn('failures', 'integer', ['default' => 0])
            ->addColumn('created_at', 'datetime')
            ->addIndex(['endpoint_hash'], ['unique' => true])
            ->addIndex(['user_id'])
            ->create();

        // Токены Strava/Garmin — зашифрованы ключом приложения.
        $this->table('integrations', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 36])
            ->addColumn('user_id', 'string', ['limit' => 36])
            ->addColumn('provider', 'string', ['limit' => 20])
            ->addColumn('external_id', 'string', ['limit' => 64, 'null' => true])
            ->addColumn('access_token_enc', 'text')
            ->addColumn('refresh_token_enc', 'text')
            ->addColumn('expires_at', 'datetime', ['null' => true])
            ->addColumn('last_sync_at', 'datetime', ['null' => true])
            ->addColumn('created_at', 'datetime')
            ->addIndex(['user_id', 'provider'], ['unique' => true])
            ->addIndex(['external_id'])
            ->create();

        // Очередь фоновых заданий: cron забирает пачками, долгих процессов нет.
        $this->table('jobs', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 36])
            ->addColumn('kind', 'string', ['limit' => 40])
            ->addColumn('payload', 'text')
            ->addColumn('run_after', 'datetime')
            ->addColumn('attempts', 'integer', ['default' => 0])
            ->addColumn('locked_at', 'datetime', ['null' => true])
            ->addColumn('done_at', 'datetime', ['null' => true])
            ->addColumn('last_error', 'text', ['null' => true])
            ->addColumn('created_at', 'datetime')
            ->addIndex(['done_at', 'run_after'])
            ->create();

        $this->table('telemetry', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 36])
            ->addColumn('user_id', 'string', ['limit' => 36, 'null' => true])
            ->addColumn('kind', 'string', ['limit' => 20])
            ->addColumn('day', 'string', ['limit' => 10])
            ->addColumn('payload', 'text')
            ->addColumn('created_at', 'datetime')
            ->addIndex(['kind', 'day'])
            ->create();

        // Контент с версиями: клиент подтягивает при синхронизации, дефолт вшит в сборку.
        $this->table('content_versions', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 36])
            ->addColumn('kind', 'string', ['limit' => 30])
            ->addColumn('version', 'integer')
            ->addColumn('data', 'text', ['limit' => \Phinx\Db\Adapter\MysqlAdapter::TEXT_LONG])
            ->addColumn('published_at', 'datetime', ['null' => true])
            ->addColumn('created_at', 'datetime')
            ->addIndex(['kind', 'version'], ['unique' => true])
            ->create();
    }
}
