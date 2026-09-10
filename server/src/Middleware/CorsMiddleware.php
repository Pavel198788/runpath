<?php
declare(strict_types=1);

namespace RunPath\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as Handler;
use Slim\Psr7\Response as SlimResponse;

/** CORS только для доменов PWA из .env. Cookies не используем, поэтому credentials не нужны. */
final class CorsMiddleware implements MiddlewareInterface
{
    /** @param string[] $origins */
    public function __construct(private array $origins)
    {
    }

    public function process(Request $request, Handler $handler): Response
    {
        $origin = $request->getHeaderLine('Origin');
        $allowed = $origin !== '' && (in_array($origin, $this->origins, true) || in_array('*', $this->origins, true));
        $response = $request->getMethod() === 'OPTIONS' ? new SlimResponse(204) : $handler->handle($request);
        if (!$allowed) {
            return $response;
        }
        return $response
            ->withHeader('Access-Control-Allow-Origin', $origin)
            ->withHeader('Vary', 'Origin')
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            ->withHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            ->withHeader('Access-Control-Max-Age', '86400');
    }
}
