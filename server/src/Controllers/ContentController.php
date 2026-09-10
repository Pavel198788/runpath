<?php
declare(strict_types=1);

namespace RunPath\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use RunPath\Container;
use RunPath\Http\Json;

/** Опубликованный контент по типу (уроки, рецепты, продукты, упражнения). Дефолт вшит в клиент. */
final class ContentController
{
    public function __construct(private Container $c)
    {
    }

    public function get(Request $request, Response $response, array $args): Response
    {
        $kind = (string) ($args['kind'] ?? '');
        $since = (int) ($request->getQueryParams()['version'] ?? 0);
        $stmt = $this->c->pdo->prepare('SELECT version, data FROM content_versions WHERE kind = ? AND published_at IS NOT NULL ORDER BY version DESC LIMIT 1');
        $stmt->execute([$kind]);
        $row = $stmt->fetch();
        if (!$row) {
            return Json::ok($response, ['version' => 0, 'data' => null]);
        }
        if ((int) $row['version'] <= $since) {
            return Json::ok($response, ['version' => (int) $row['version'], 'upToDate' => true]);
        }
        return Json::ok($response, ['version' => (int) $row['version'], 'data' => json_decode((string) $row['data'], true)]);
    }
}
