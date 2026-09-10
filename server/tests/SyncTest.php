<?php
declare(strict_types=1);

namespace RunPath\Tests;

final class SyncTest extends TestCase
{
    public function testPushAndPullRoundTrip(): void
    {
        $tokens = $this->registerUser();
        $push = $this->json($this->request('POST', '/v1/sync/push', [
            'documents' => [
                $this->doc('workoutLogs', 'log-1', '2026-09-01T10:00:00.000Z', ['durationSec' => 1800]),
                $this->doc('plans', 'plan-1', '2026-09-01T10:00:00.000Z', ['goal' => 'marathon']),
            ],
        ], $tokens['accessToken']));

        self::assertCount(2, $push['accepted']);
        self::assertSame([], $push['conflicts']);
        self::assertSame(2, $push['version']);

        $changes = $this->json($this->request('GET', '/v1/sync/changes?since=0', null, $tokens['accessToken']));
        self::assertCount(2, $changes['documents']);
        self::assertSame(1800, $changes['documents'][0]['data']['durationSec']);

        // Инкрементальная выборка: после версии 1 приходит только второй документ.
        $tail = $this->json($this->request('GET', '/v1/sync/changes?since=1', null, $tokens['accessToken']));
        self::assertCount(1, $tail['documents']);
        self::assertSame('plan-1', $tail['documents'][0]['id']);
    }

    public function testLastWriteWinsAndStaleConflict(): void
    {
        $tokens = $this->registerUser();
        $this->request('POST', '/v1/sync/push', ['documents' => [$this->doc('settings', 'settings', '2026-09-02T10:00:00.000Z', ['units' => 'metric'])]], $tokens['accessToken']);

        // Более новая версия принимается.
        $newer = $this->json($this->request('POST', '/v1/sync/push', ['documents' => [$this->doc('settings', 'settings', '2026-09-03T10:00:00.000Z', ['units' => 'imperial'])]], $tokens['accessToken']));
        self::assertCount(1, $newer['accepted']);

        // Более старая — отклоняется как устаревшая.
        $older = $this->json($this->request('POST', '/v1/sync/push', ['documents' => [$this->doc('settings', 'settings', '2026-09-01T10:00:00.000Z', ['units' => 'metric'])]], $tokens['accessToken']));
        self::assertSame([], $older['accepted']);
        self::assertSame('stale', $older['conflicts'][0]['reason']);

        $changes = $this->json($this->request('GET', '/v1/sync/changes?since=0', null, $tokens['accessToken']));
        self::assertSame('imperial', $changes['documents'][0]['data']['units']);
    }

    public function testSoftDeleteSyncs(): void
    {
        $tokens = $this->registerUser();
        $this->request('POST', '/v1/sync/push', ['documents' => [$this->doc('shoes', 'shoe-1', '2026-09-01T10:00:00.000Z', ['name' => 'Asics'])]], $tokens['accessToken']);
        $deleted = $this->doc('shoes', 'shoe-1', '2026-09-05T10:00:00.000Z', ['name' => 'Asics']);
        $deleted['deletedAt'] = '2026-09-05T10:00:00.000Z';
        $this->request('POST', '/v1/sync/push', ['documents' => [$deleted]], $tokens['accessToken']);

        $changes = $this->json($this->request('GET', '/v1/sync/changes?since=1', null, $tokens['accessToken']));
        self::assertSame('2026-09-05T10:00:00.000Z', $changes['documents'][0]['deletedAt']);
    }

    public function testRejectsUnknownCollectionAndOversizedDocument(): void
    {
        $tokens = $this->registerUser();
        $result = $this->json($this->request('POST', '/v1/sync/push', [
            'documents' => [
                ['collection' => 'evil_table', 'id' => 'x', 'updatedAt' => '2026-09-01T00:00:00Z', 'data' => []],
                ['collection' => 'workoutLogs', 'id' => 'y', 'updatedAt' => '2026-09-01T00:00:00Z', 'data' => ['blob' => str_repeat('a', 1_600_000)]],
            ],
        ], $tokens['accessToken']));

        self::assertSame([], $result['accepted']);
        self::assertSame('unknown_collection', $result['conflicts'][0]['reason']);
        self::assertSame('too_large', $result['conflicts'][1]['reason']);
    }

    public function testUsersDoNotSeeEachOthersData(): void
    {
        $first = $this->registerUser('a@example.com');
        $second = $this->registerUser('b@example.com');
        $this->request('POST', '/v1/sync/push', ['documents' => [$this->doc('workoutLogs', 'log-a', '2026-09-01T10:00:00.000Z', ['note' => 'мой'])]], $first['accessToken']);

        $changes = $this->json($this->request('GET', '/v1/sync/changes?since=0', null, $second['accessToken']));
        self::assertSame([], $changes['documents']);
    }

    /** @return array<string, mixed> */
    private function doc(string $collection, string $id, string $updatedAt, array $data = []): array
    {
        return ['collection' => $collection, 'id' => $id, 'updatedAt' => $updatedAt, 'deletedAt' => null, 'data' => ['id' => $id] + $data];
    }
}
