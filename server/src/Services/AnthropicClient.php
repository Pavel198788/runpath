<?php
declare(strict_types=1);

namespace RunPath\Services;

/**
 * Тонкий клиент Anthropic Messages API на curl (без зависимостей).
 * Системный промт помечается cache_control — он большой и не меняется, кэш экономит токены.
 */
final class AnthropicClient
{
    private const URL = 'https://api.anthropic.com/v1/messages';
    private const VERSION = '2023-06-01';

    public function __construct(private string $apiKey, private string $model, private Logger $logger)
    {
    }

    /**
     * @param array<int, array<string, mixed>> $messages
     * @return array{text?: string, inputTokens: int, outputTokens: int, error?: string}
     */
    public function complete(string $system, array $messages, int $maxTokens): array
    {
        $ch = curl_init(self::URL);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_HTTPHEADER => $this->headers(),
            CURLOPT_POSTFIELDS => json_encode($this->payload($system, $messages, $maxTokens, false), JSON_UNESCAPED_UNICODE),
        ]);
        $raw = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($raw === false) {
            $this->logger->error('anthropic curl failed', ['err' => $err]);
            return ['inputTokens' => 0, 'outputTokens' => 0, 'error' => 'Сервис ИИ недоступен'];
        }
        $json = json_decode((string) $raw, true);
        if ($status >= 400 || !is_array($json)) {
            $this->logger->error('anthropic error', ['status' => $status, 'body' => mb_substr((string) $raw, 0, 500)]);
            return ['inputTokens' => 0, 'outputTokens' => 0, 'error' => $json['error']['message'] ?? 'Ошибка сервиса ИИ'];
        }
        $text = '';
        foreach ($json['content'] ?? [] as $block) {
            if (($block['type'] ?? '') === 'text') {
                $text .= $block['text'];
            }
        }
        return [
            'text' => $text,
            'inputTokens' => (int) ($json['usage']['input_tokens'] ?? 0),
            'outputTokens' => (int) ($json['usage']['output_tokens'] ?? 0),
        ];
    }

    /**
     * Стриминг: onChunk(текст, null) для кусков, onChunk('', ['input'=>, 'output'=>]) для учёта токенов.
     * @param array<int, array<string, mixed>> $messages
     */
    public function stream(string $system, array $messages, int $maxTokens, callable $onChunk): void
    {
        $buffer = '';
        $ch = curl_init(self::URL);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_TIMEOUT => 300,
            CURLOPT_HTTPHEADER => $this->headers(),
            CURLOPT_POSTFIELDS => json_encode($this->payload($system, $messages, $maxTokens, true), JSON_UNESCAPED_UNICODE),
            CURLOPT_WRITEFUNCTION => function ($ch, string $data) use (&$buffer, $onChunk): int {
                $buffer .= $data;
                while (($pos = strpos($buffer, "\n\n")) !== false) {
                    $event = substr($buffer, 0, $pos);
                    $buffer = substr($buffer, $pos + 2);
                    foreach (explode("\n", $event) as $line) {
                        if (!str_starts_with($line, 'data:')) {
                            continue;
                        }
                        $json = json_decode(trim(substr($line, 5)), true);
                        if (!is_array($json)) {
                            continue;
                        }
                        if (($json['type'] ?? '') === 'content_block_delta' && ($json['delta']['type'] ?? '') === 'text_delta') {
                            $onChunk((string) $json['delta']['text'], null);
                        } elseif (($json['type'] ?? '') === 'message_start') {
                            $onChunk('', ['input' => (int) ($json['message']['usage']['input_tokens'] ?? 0), 'output' => 0]);
                        } elseif (($json['type'] ?? '') === 'message_delta') {
                            $onChunk('', ['input' => 0, 'output' => (int) ($json['usage']['output_tokens'] ?? 0)]);
                        }
                    }
                }
                return strlen($data);
            },
        ]);
        curl_exec($ch);
        if (curl_errno($ch)) {
            $this->logger->error('anthropic stream failed', ['err' => curl_error($ch)]);
        }
        curl_close($ch);
    }

    /** @return string[] */
    private function headers(): array
    {
        return ['content-type: application/json', 'x-api-key: ' . $this->apiKey, 'anthropic-version: ' . self::VERSION];
    }

    /** @param array<int, array<string, mixed>> $messages @return array<string, mixed> */
    private function payload(string $system, array $messages, int $maxTokens, bool $stream): array
    {
        return [
            'model' => $this->model,
            'max_tokens' => max(256, min(4096, $maxTokens)),
            'system' => [['type' => 'text', 'text' => $system, 'cache_control' => ['type' => 'ephemeral']]],
            'messages' => $messages,
            'stream' => $stream,
        ];
    }
}
