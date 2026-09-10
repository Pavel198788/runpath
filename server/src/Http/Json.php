<?php
declare(strict_types=1);

namespace RunPath\Http;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Exception\HttpBadRequestException;

/** Помощники для JSON-ответов и разбора тела запроса. */
final class Json
{
    public static function ok(Response $response, mixed $data, int $status = 200): Response
    {
        $response->getBody()->write(json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        return $response->withStatus($status)->withHeader('Content-Type', 'application/json; charset=utf-8');
    }

    public static function error(Response $response, string $code, string $message, int $status = 400): Response
    {
        return self::ok($response, ['error' => $code, 'message' => $message], $status);
    }

    /** @return array<string, mixed> */
    public static function body(Request $request): array
    {
        $body = $request->getParsedBody();
        if (!is_array($body)) {
            throw new HttpBadRequestException($request, 'Ожидается JSON-объект');
        }
        return $body;
    }

    /** Обязательная строка из тела с ограничением длины. */
    public static function str(Request $request, array $body, string $key, int $max = 255, bool $required = true): string
    {
        $v = $body[$key] ?? null;
        if ($v === null || $v === '') {
            if ($required) {
                throw new HttpBadRequestException($request, "Поле {$key} обязательно");
            }
            return '';
        }
        if (!is_string($v) || mb_strlen($v) > $max) {
            throw new HttpBadRequestException($request, "Поле {$key} некорректно");
        }
        return $v;
    }
}
