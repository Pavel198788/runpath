<?php
/** Генерация пары ключей VAPID для Web Push. Запустить один раз, результат вписать в .env. */
declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

$keys = Minishlink\WebPush\VAPID::createVapidKeys();
echo "VAPID_PUBLIC_KEY={$keys['publicKey']}\n";
echo "VAPID_PRIVATE_KEY={$keys['privateKey']}\n";
