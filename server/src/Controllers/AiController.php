<?php
declare(strict_types=1);

namespace RunPath\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use RunPath\Container;
use RunPath\Db;
use RunPath\Http\Json;
use RunPath\Services\AiQuota;
use RunPath\Services\AnthropicClient;

/**
 * Прокси к Anthropic с ключом владельца. Ключ никогда не уходит в браузер.
 * Квоты: N сообщений в день на пользователя и месячный бюджет на весь сервис.
 * Стриминг через SSE, если хостинг позволяет (проверяется CHECK.php); иначе обычный JSON.
 */
final class AiController
{
    private const MAX_MESSAGES = 24;

    public function __construct(private Container $c)
    {
    }

    public function quota(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $quota = new AiQuota($this->c);
        return Json::ok($response, $quota->status($user['id']));
    }

    public function chat(Request $request, Response $response): Response
    {
        $user = $request->getAttribute('user');
        $settings = $this->c->settings();
        $features = $settings->get('features', []);
        if (!($features['ai'] ?? true)) {
            return Json::error($response, 'ai_disabled', 'ИИ-тренер временно выключен', 503);
        }
        $apiKey = $this->c->config->get('ANTHROPIC_API_KEY');
        if ($apiKey === '') {
            return Json::error($response, 'ai_not_configured', 'ИИ-тренер не настроен на сервере', 503);
        }

        $quota = new AiQuota($this->c);
        $check = $quota->check($user['id']);
        if (!$check['allowed']) {
            return Json::error($response, $check['reason'], $check['message'], 429);
        }

        $body = Json::body($request);
        $messages = $body['messages'] ?? [];
        $system = (string) ($body['system'] ?? '');
        if (!is_array($messages) || $messages === []) {
            return Json::error($response, 'invalid_body', 'messages обязателен');
        }
        if (count($messages) > self::MAX_MESSAGES) {
            $messages = array_slice($messages, -self::MAX_MESSAGES);
        }
        // Ограничение длины контекста: обрезаем самое старое, чтобы не разориться на токенах.
        $maxChars = (int) $settings->get('ai_max_context_chars', 24000);
        $messages = $this->trim($messages, $maxChars);

        $client = new AnthropicClient($apiKey, (string) $settings->get('ai_model', 'claude-sonnet-5'), $this->c->logger());
        $wantsStream = str_contains($request->getHeaderLine('Accept'), 'text/event-stream') && $this->canStream();

        if (!$wantsStream) {
            $result = $client->complete($system, $messages, (int) ($body['maxTokens'] ?? 1024));
            if (isset($result['error'])) {
                return Json::error($response, 'ai_error', $result['error'], 502);
            }
            $quota->record($user['id'], $result['inputTokens'], $result['outputTokens']);
            return Json::ok($response, ['text' => $result['text'], 'quota' => $quota->status($user['id'])]);
        }

        // SSE: отдаём куски по мере получения. Буферизацию выключаем, иначе клиент увидит всё в конце.
        $response = $response
            ->withHeader('Content-Type', 'text/event-stream; charset=utf-8')
            ->withHeader('Cache-Control', 'no-cache')
            ->withHeader('X-Accel-Buffering', 'no');
        $stream = $response->getBody();
        $usage = ['input' => 0, 'output' => 0];
        $client->stream($system, $messages, (int) ($body['maxTokens'] ?? 1024), function (string $chunk, ?array $tokens) use ($stream, &$usage) {
            if ($tokens !== null) {
                $usage['input'] += $tokens['input'] ?? 0;
                $usage['output'] += $tokens['output'] ?? 0;
                return;
            }
            $stream->write('data: ' . json_encode(['text' => $chunk], JSON_UNESCAPED_UNICODE) . "\n\n");
            if (function_exists('ob_flush')) {
                @ob_flush();
            }
            @flush();
        });
        $quota->record($user['id'], $usage['input'], $usage['output']);
        $stream->write('data: ' . json_encode(['done' => true, 'quota' => $quota->status($user['id'])], JSON_UNESCAPED_UNICODE) . "\n\n");
        return $response;
    }

    /** Стриминг возможен, только если сервер не буферизует вывод и не режет по времени. */
    private function canStream(): bool
    {
        $maxTime = (int) ini_get('max_execution_time');
        return ($maxTime === 0 || $maxTime >= 60) && !(bool) ini_get('output_buffering');
    }

    /** @param array<int, array<string, mixed>> $messages @return array<int, array<string, mixed>> */
    private function trim(array $messages, int $maxChars): array
    {
        $total = 0;
        $kept = [];
        foreach (array_reverse($messages) as $m) {
            $len = mb_strlen((string) ($m['content'] ?? ''));
            if ($total + $len > $maxChars && $kept !== []) {
                break;
            }
            $total += $len;
            $kept[] = ['role' => ($m['role'] ?? 'user') === 'assistant' ? 'assistant' : 'user', 'content' => mb_substr((string) ($m['content'] ?? ''), 0, $maxChars)];
        }
        return array_reverse($kept);
    }
}
