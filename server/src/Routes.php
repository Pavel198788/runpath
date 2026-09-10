<?php
declare(strict_types=1);

namespace RunPath;

use RunPath\Controllers\AdminController;
use RunPath\Controllers\AiController;
use RunPath\Controllers\AuthController;
use RunPath\Controllers\ContentController;
use RunPath\Controllers\IntegrationController;
use RunPath\Controllers\PushController;
use RunPath\Controllers\SyncController;
use RunPath\Controllers\TelemetryController;
use RunPath\Http\Json;
use RunPath\Middleware\AuthMiddleware;
use RunPath\Middleware\RateLimitMiddleware;
use Slim\App;
use Slim\Routing\RouteCollectorProxy;

/** Все маршруты API. Версия в пути: /api/v1. */
final class Routes
{
    public static function register(App $app, Container $c): void
    {
        $auth = fn(bool $adminOnly = false) => new AuthMiddleware($c, $adminOnly);
        $limit = fn(string $bucket, int $n, int $sec) => new RateLimitMiddleware($c, $bucket, $n, $sec);

        $app->group('/v1', function (RouteCollectorProxy $g) use ($c, $auth, $limit) {
            $g->get('/health', fn($rq, $rs) => Json::ok($rs, ['ok' => true, 'time' => gmdate('c'), 'version' => 1]));

            $g->group('/auth', function (RouteCollectorProxy $a) use ($c) {
                $ctrl = new AuthController($c);
                $a->post('/register', [$ctrl, 'register']);
                $a->post('/login', [$ctrl, 'login']);
                $a->post('/refresh', [$ctrl, 'refresh']);
                $a->post('/logout', [$ctrl, 'logout']);
                $a->post('/verify', [$ctrl, 'verify']);
                $a->post('/forgot', [$ctrl, 'forgot']);
                $a->post('/reset', [$ctrl, 'reset']);
            })->add($limit('auth', 20, 600));

            $g->get('/me', [new AuthController($c), 'me'])->add($auth());
            $g->delete('/me', [new AuthController($c), 'deleteAccount'])->add($auth());

            $g->group('/sync', function (RouteCollectorProxy $s) use ($c) {
                $ctrl = new SyncController($c);
                $s->get('/changes', [$ctrl, 'changes']);
                $s->post('/push', [$ctrl, 'push']);
            })->add($limit('sync', 120, 60))->add($auth());

            $g->group('/ai', function (RouteCollectorProxy $a) use ($c) {
                $ctrl = new AiController($c);
                $a->post('/chat', [$ctrl, 'chat']);
                $a->get('/quota', [$ctrl, 'quota']);
            })->add($limit('ai', 30, 3600))->add($auth());

            $g->group('/push', function (RouteCollectorProxy $p) use ($c) {
                $ctrl = new PushController($c);
                $p->get('/key', [$ctrl, 'publicKey']);
                $p->post('/subscribe', [$ctrl, 'subscribe']);
                $p->post('/unsubscribe', [$ctrl, 'unsubscribe']);
            })->add($auth());

            $g->group('/integrations', function (RouteCollectorProxy $i) use ($c) {
                $ctrl = new IntegrationController($c);
                $i->get('', [$ctrl, 'list']);
                $i->get('/strava/authorize', [$ctrl, 'stravaAuthorize']);
                $i->delete('/{provider}', [$ctrl, 'disconnect']);
                $i->post('/{provider}/sync', [$ctrl, 'syncNow']);
            })->add($auth());

            $g->get('/content/{kind}', [new ContentController($c), 'get']);
            $g->post('/telemetry', [new TelemetryController($c), 'collect'])->add($limit('telemetry', 60, 3600));

            $g->group('/admin', function (RouteCollectorProxy $ad) use ($c) {
                $ctrl = new AdminController($c);
                $ad->get('/stats', [$ctrl, 'stats']);
                $ad->get('/users', [$ctrl, 'users']);
                $ad->post('/users/{id}/block', [$ctrl, 'blockUser']);
                $ad->post('/users/{id}/reset-quota', [$ctrl, 'resetQuota']);
                $ad->delete('/users/{id}', [$ctrl, 'deleteUser']);
                $ad->get('/settings', [$ctrl, 'getSettings']);
                $ad->put('/settings', [$ctrl, 'putSettings']);
                $ad->put('/content/{kind}', [$ctrl, 'putContent']);
                $ad->post('/content/{kind}/publish', [$ctrl, 'publishContent']);
            })->add($auth(true));
        });

        // Публичные точки без авторизации: OAuth-callback и webhook Strava.
        $app->get('/v1/integrations/strava/callback', [new IntegrationController($c), 'stravaCallback']);
        $app->map(['GET', 'POST'], '/v1/integrations/strava/webhook', [new IntegrationController($c), 'stravaWebhook']);
    }
}
