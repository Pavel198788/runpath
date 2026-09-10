<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

/**
 * Базовые таблицы: пользователи, токены, синхронизация, лимиты, настройки.
 * Зеркалит клиентскую схему Dexie: у сущностей те же id (UUID), updated_at, deleted_at.
 */
final class CreateCoreTables extends AbstractMigration
{
    public function change(): void
    {
        $this->table('users', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 36])
            ->addColumn('email', 'string', ['limit' => 190])
            ->addColumn('password_hash', 'string', ['limit' => 255])
            ->addColumn('role', 'string', ['limit' => 16, 'default' => 'user'])
            ->addColumn('email_verified_at', 'datetime', ['null' => true])
            ->addColumn('blocked_at', 'datetime', ['null' => true])
            ->addColumn('sync_version', 'biginteger', ['default' => 0])
            ->addColumn('created_at', 'datetime')
            ->addColumn('updated_at', 'datetime')
            ->addColumn('deleted_at', 'datetime', ['null' => true])
            ->addIndex(['email'], ['unique' => true])
            ->create();

        // Refresh-токены: храним только хэш, ротация при каждом обновлении.
        $this->table('refresh_tokens', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 36])
            ->addColumn('user_id', 'string', ['limit' => 36])
            ->addColumn('token_hash', 'string', ['limit' => 64])
            ->addColumn('expires_at', 'datetime')
            ->addColumn('revoked_at', 'datetime', ['null' => true])
            ->addColumn('created_at', 'datetime')
            ->addIndex(['token_hash'])
            ->addIndex(['user_id'])
            ->create();

        // Одноразовые токены: подтверждение почты и сброс пароля.
        $this->table('user_tokens', ['id' => false, 'primary_key' => ['id']])
            ->addColumn('id', 'string', ['limit' => 36])
            ->addColumn('user_id', 'string', ['limit' => 36])
            ->addColumn('kind', 'string', ['limit' => 20])
            ->addColumn('token_hash', 'string', ['limit' => 64])
            ->addColumn('expires_at', 'datetime')
            ->addColumn('used_at', 'datetime', ['null' => true])
            ->addColumn('created_at', 'datetime')
            ->addIndex(['token_hash'])
            ->create();

        /**
         * Универсальное хранилище синхронизируемых сущностей.
         * Клиент присылает документы как есть (JSON), сервер хранит их и присваивает
         * возрастающий sync_version. Так добавление новой сущности на клиенте
         * не требует миграции сервера — важно для shared-хостинга.
         */
        $this->table('documents', ['id' => false, 'primary_key' => ['user_id', 'collection', 'id']])
            ->addColumn('user_id', 'string', ['limit' => 36])
            ->addColumn('collection', 'string', ['limit' => 40])
            ->addColumn('id', 'string', ['limit' => 36])
            ->addColumn('data', 'text', ['limit' => \Phinx\Db\Adapter\MysqlAdapter::TEXT_LONG])
            ->addColumn('updated_at', 'string', ['limit' => 32])
            ->addColumn('deleted_at', 'string', ['limit' => 32, 'null' => true])
            ->addColumn('sync_version', 'biginteger')
            ->addColumn('server_updated_at', 'datetime')
            ->addIndex(['user_id', 'sync_version'])
            ->create();

        $this->table('rate_limits', ['id' => false, 'primary_key' => ['key', 'window_start']])
            ->addColumn('key', 'string', ['limit' => 120])
            ->addColumn('window_start', 'integer')
            ->addColumn('count', 'integer', ['default' => 0])
            ->create();

        $this->table('settings', ['id' => false, 'primary_key' => ['key']])
            ->addColumn('key', 'string', ['limit' => 60])
            ->addColumn('value', 'text')
            ->addColumn('updated_at', 'datetime')
            ->create();
    }
}
