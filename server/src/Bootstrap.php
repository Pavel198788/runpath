<?php
declare(strict_types=1);

namespace RunPath;

use PDO;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use RunPath\Middleware\CorsMiddleware;
use RunPath\Middleware\SecurityHeadersMiddleware;
use Slim\App;
use Slim\Factory\AppFactory;
use Throwable;

/** Собирает приложение: конфиг, БД, middleware, маршруты, обработка ошибок без утечки стека. */
final class Bootstrap
{
    public static function create(string $root): App
    {
        $config = new Config($root);
        $pdo = Db::connect($config, $root);
        $container = new Container($config, $pdo, $root);

        $app = AppFactory::create();
        $app->setBasePath(self::detectBasePath());
        $app->addBodyParsingMiddleware();
        $app->addRoutingMiddleware();
        $app->add(new SecurityHeadersMiddleware());
        $app->add(new CorsMiddleware($config->list('CLIENT_ORIGINS')));

        $errorMiddleware = $app->addErrorMiddleware(false, true, true, $container->logger());
        $errorMiddleware->setDefaultErrorHandler(function (Request $request, Throwable $e) use ($app, $container): Response {
            $status = $e instanceof \Slim\Exception\HttpException ? $e->getCode() : 500;
            if ($status >= 500) {
                $container->logger()->error($e->getMessage(), ['trace' => $e->getTraceAsString(), 'uri' => (string) $request->getUri()]);
            }
            $payload = ['error' => $status >= 500 ? 'internal_error' : ($e instanceof \Slim\Exception\HttpException ? strtolower(str_replace(' ', '_', $e->getTitle())) : 'error')];
            if ($status < 500) {
                $payload['message'] = $e->getMessage();
            }
            $response = $app->getResponseFactory()->createResponse($status);
            $response->getBody()->write(json_encode($payload, JSON_UNESCAPED_UNICODE));
            return $response->withHeader('Content-Type', 'application/json');
        });

        Routes::register($app, $container);
        return $app;
    }

    /** На shared-хостинге API может лежать в подпапке /api — определяем по SCRIPT_NAME. */
    private static function detectBasePath(): string
    {
        $script = $_SERVER['SCRIPT_NAME'] ?? '';
        $dir = str_replace('\\', '/', dirname($script));
        return $dir === '/' || $dir === '.' ? '' : rtrim($dir, '/');
    }
}
