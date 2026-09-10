<?php
declare(strict_types=1);

namespace RunPath\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;
use RunPath\Container;
use RunPath\Http\Json;
use Slim\Psr7\Response as SlimResponse;

/** Ограничение частоты по IP (и по пользователю, если он известен). Счётчики — в таблице БД, без Redis. */
final class RateLimitMiddleware implements MiddlewareInterface
{
    public function __construct(private Container $c, private string $bucket, private int $limit, private int $windowSec)
    {
    }

    public function process(Request $request, Handler $handler): Response
    {
        $ip = $request->getServerParams()['REMOTE_ADDR'] ?? 'unknown';
        $user = $request->getAttribute('user');
        $key = $this->bucket . ':' . ($user['id'] ?? $ip);
        if (!$this->c->rateLimiter()->allow($key, $this->limit, $this->windowSec)) {
            return Json::error(new SlimResponse(), 'rate_limited', 'Слишком много запросов, попробуйте позже', 429)
                ->withHeader('Retry-After', (string) $this->windowSec);
        }
        return $handler->handle($request);
    }
}
