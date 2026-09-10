<?php
declare(strict_types=1);

namespace RunPath\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;
use RunPath\Container;
use Slim\Exception\HttpForbiddenException;
use Slim\Exception\HttpUnauthorizedException;

/** Проверяет Bearer access-токен и кладёт пользователя в атрибуты запроса. */
final class AuthMiddleware implements MiddlewareInterface
{
    public function __construct(private Container $c, private bool $adminOnly = false)
    {
    }

    public function process(Request $request, Handler $handler): Response
    {
        $header = $request->getHeaderLine('Authorization');
        if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
            throw new HttpUnauthorizedException($request, 'Нужен токен');
        }
        $claims = $this->c->jwt()->verify($m[1]);
        if (!$claims || ($claims['typ'] ?? '') !== 'access') {
            throw new HttpUnauthorizedException($request, 'Токен недействителен');
        }
        $stmt = $this->c->pdo->prepare('SELECT id, email, role, blocked_at FROM users WHERE id = ? AND deleted_at IS NULL');
        $stmt->execute([$claims['sub']]);
        $user = $stmt->fetch();
        if (!$user || $user['blocked_at'] !== null) {
            throw new HttpUnauthorizedException($request, 'Пользователь не найден или заблокирован');
        }
        if ($this->adminOnly && $user['role'] !== 'admin') {
            throw new HttpForbiddenException($request, 'Только для администратора');
        }
        return $handler->handle($request->withAttribute('user', $user));
    }
}
