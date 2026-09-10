<?php
declare(strict_types=1);

namespace RunPath\Services;

use RunPath\Container;
use RunPath\Db;
use RunPath\Support\Crypto;

/**
 * Клиент Strava API. Лимиты Strava: 100 запросов за 15 минут и 1000 в сутки на приложение,
 * поэтому опрос делаем редко (раз в 15 минут из cron) и берём только новые активности.
 */
final class StravaClient
{
    public function __construct(private Container $c)
    {
    }

    /** @return array{access: string, refresh: string, expiresAt: int, athleteId: string}|null */
    public function exchangeCode(string $code): ?array
    {
        $res = $this->post('https://www.strava.com/oauth/token', [
            'client_id' => $this->c->config->get('STRAVA_CLIENT_ID'),
            'client_secret' => $this->c->config->get('STRAVA_CLIENT_SECRET'),
            'code' => $code,
            'grant_type' => 'authorization_code',
        ]);
        if (!isset($res['access_token'])) {
            return null;
        }
        return [
            'access' => (string) $res['access_token'],
            'refresh' => (string) $res['refresh_token'],
            'expiresAt' => (int) $res['expires_at'],
            'athleteId' => (string) ($res['athlete']['id'] ?? ''),
        ];
    }

    /** Возвращает действующий access-токен, обновляя его при необходимости. */
    public function accessTokenFor(string $userId): ?string
    {
        $crypto = new Crypto($this->c->config->get('APP_KEY'));
        $stmt = $this->c->pdo->prepare('SELECT id, access_token_enc, refresh_token_enc, expires_at FROM integrations WHERE user_id = ? AND provider = ?');
        $stmt->execute([$userId, 'strava']);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }
        if ($row['expires_at'] > gmdate('Y-m-d H:i:s', time() + 300)) {
            return $crypto->decrypt((string) $row['access_token_enc']);
        }
        $refresh = $crypto->decrypt((string) $row['refresh_token_enc']);
        if ($refresh === null) {
            return null;
        }
        $res = $this->post('https://www.strava.com/oauth/token', [
            'client_id' => $this->c->config->get('STRAVA_CLIENT_ID'),
            'client_secret' => $this->c->config->get('STRAVA_CLIENT_SECRET'),
            'refresh_token' => $refresh,
            'grant_type' => 'refresh_token',
        ]);
        if (!isset($res['access_token'])) {
            return null;
        }
        $this->c->pdo->prepare('UPDATE integrations SET access_token_enc = ?, refresh_token_enc = ?, expires_at = ? WHERE id = ?')
            ->execute([$crypto->encrypt((string) $res['access_token']), $crypto->encrypt((string) $res['refresh_token']), gmdate('Y-m-d H:i:s', (int) $res['expires_at']), $row['id']]);
        return (string) $res['access_token'];
    }

    /**
     * Новые активности после времени последней синхронизации.
     * @return array<int, array<string, mixed>>
     */
    public function recentActivities(string $userId, ?string $after): array
    {
        $token = $this->accessTokenFor($userId);
        if ($token === null) {
            return [];
        }
        $params = ['per_page' => 30];
        if ($after !== null) {
            $params['after'] = strtotime($after . ' UTC');
        }
        $res = $this->get('https://www.strava.com/api/v3/athlete/activities?' . http_build_query($params), $token);
        return is_array($res) ? $res : [];
    }

    /** Приводит активность Strava к нашему формату документа журнала. */
    public function toWorkoutLog(array $a): ?array
    {
        $type = strtolower((string) ($a['sport_type'] ?? $a['type'] ?? ''));
        $sport = str_contains($type, 'run') ? 'easy' : (str_contains($type, 'walk') || str_contains($type, 'hike') ? 'walk' : null);
        if ($sport === null) {
            return null;
        }
        $start = (string) ($a['start_date_local'] ?? $a['start_date'] ?? gmdate('c'));
        return [
            'externalId' => 'strava-' . ($a['id'] ?? ''),
            'date' => substr($start, 0, 10),
            'startTime' => $start,
            'type' => $sport,
            'source' => 'strava',
            'durationSec' => (int) ($a['moving_time'] ?? $a['elapsed_time'] ?? 0),
            'distanceM' => isset($a['distance']) ? (int) round((float) $a['distance']) : null,
            'avgHr' => isset($a['average_heartrate']) ? (int) round((float) $a['average_heartrate']) : null,
            'elevationGainM' => isset($a['total_elevation_gain']) ? (int) round((float) $a['total_elevation_gain']) : null,
            'name' => (string) ($a['name'] ?? ''),
        ];
    }

    /** @return array<string, mixed> */
    private function post(string $url, array $data): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_POSTFIELDS => http_build_query($data)]);
        $raw = curl_exec($ch);
        curl_close($ch);
        $json = json_decode((string) $raw, true);
        return is_array($json) ? $json : [];
    }

    private function get(string $url, string $token): mixed
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token]]);
        $raw = curl_exec($ch);
        curl_close($ch);
        return json_decode((string) $raw, true);
    }
}
