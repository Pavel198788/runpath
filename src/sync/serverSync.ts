import { db } from '@/data/db'
import { ApiError, type Api } from './api'
import { clearItems, enqueueEverything, outboxSize, takeBatch } from './outbox'
import type { SyncAdapter, SyncMeta, SyncState, SyncedCollection } from './types'

/**
 * Синхронизация local-first с сервером.
 *
 * Порядок одного прохода: отправить очередь → скачать изменения с версии N → записать локально.
 * Конфликты решаются по updatedAt (последняя запись побеждает), сервер сам отклоняет устаревшее.
 * Если сети нет — тихо откладываем: приложение продолжает работать на устройстве.
 */
export class ServerSync implements SyncAdapter {
  private listeners = new Set<(state: SyncState) => void>()
  private running = false
  state: SyncState = {
    status: 'signed_out',
    pending: 0,
    lastSyncAt: null,
    error: null,
    email: null,
  }

  constructor(private api: Api) {
    void this.init()
  }

  private async init() {
    const meta = await this.meta()
    this.update({
      status: meta.accessToken ? 'idle' : 'signed_out',
      email: meta.email,
      lastSyncAt: meta.lastSyncAt,
      pending: await outboxSize(),
    })
  }

  subscribe(listener: (state: SyncState) => void) {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  private update(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch }
    for (const l of this.listeners) l(this.state)
  }

  async meta(): Promise<SyncMeta> {
    const existing = await db.syncMeta.get('meta')
    return (
      existing ?? {
        key: 'meta',
        serverVersion: 0,
        lastSyncAt: null,
        accessToken: null,
        refreshToken: null,
        email: null,
        userId: null,
      }
    )
  }

  private async saveMeta(patch: Partial<SyncMeta>) {
    const meta = await this.meta()
    await db.syncMeta.put({ ...meta, ...patch })
  }

  async signIn(email: string, password: string, mode: 'login' | 'register'): Promise<void> {
    const tokens =
      mode === 'register'
        ? await this.api.register(email, password)
        : await this.api.login(email, password)
    const me = await this.api.me(tokens.accessToken)
    await this.saveMeta({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      email: me.email,
      userId: me.id,
    })
    // При первом входе поднимаем в аккаунт всё, что уже накоплено на устройстве.
    await enqueueEverything()
    this.update({ status: 'idle', email: me.email, error: null, pending: await outboxSize() })
    await this.sync()
  }

  async signOut(): Promise<void> {
    const meta = await this.meta()
    if (meta.refreshToken) {
      try {
        await this.api.logout(meta.refreshToken)
      } catch {
        // Выход должен работать и без сети.
      }
    }
    // Локальные данные остаются: приложение продолжает работать в гостевом режиме.
    await this.saveMeta({
      accessToken: null,
      refreshToken: null,
      email: null,
      userId: null,
      serverVersion: 0,
    })
    await db.outbox.clear()
    this.update({ status: 'signed_out', email: null, pending: 0, error: null })
  }

  async deleteAccount(): Promise<void> {
    const token = await this.token()
    if (token) await this.api.deleteAccount(token)
    await this.signOut()
  }

  /** Возвращает действующий access-токен, обновляя его при необходимости. */
  private async token(): Promise<string | null> {
    const meta = await this.meta()
    if (!meta.accessToken || !meta.refreshToken) return null
    try {
      await this.api.me(meta.accessToken)
      return meta.accessToken
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        try {
          const tokens = await this.api.refresh(meta.refreshToken)
          await this.saveMeta({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
          })
          return tokens.accessToken
        } catch {
          await this.signOut()
          return null
        }
      }
      throw e
    }
  }

  async sync(): Promise<void> {
    if (this.running) return
    const meta = await this.meta()
    if (!meta.accessToken) return
    if (!navigator.onLine) {
      this.update({ status: 'offline', pending: await outboxSize() })
      return
    }
    this.running = true
    this.update({ status: 'syncing', error: null })
    try {
      const token = await this.token()
      if (!token) return
      await this.pushOutbox(token)
      await this.pullChanges(token)
      const now = new Date().toISOString()
      await this.saveMeta({ lastSyncAt: now })
      this.update({ status: 'idle', lastSyncAt: now, pending: await outboxSize(), error: null })
    } catch (e) {
      const offline = e instanceof ApiError && e.code === 'offline'
      this.update({
        status: offline ? 'offline' : 'error',
        error: offline ? null : e instanceof Error ? e.message : 'Не удалось синхронизировать',
        pending: await outboxSize(),
      })
    } finally {
      this.running = false
    }
  }

  private async pushOutbox(token: string): Promise<void> {
    for (;;) {
      const batch = await takeBatch(200)
      if (batch.length === 0) return
      const documents = []
      for (const item of batch) {
        const entity = (await db.table(item.collection).get(item.entityId)) as
          Record<string, unknown> | undefined
        if (!entity) continue
        documents.push({
          collection: item.collection,
          id: item.entityId,
          updatedAt: String(entity.updatedAt ?? item.updatedAt),
          deletedAt: (entity.deletedAt as string | null) ?? null,
          data: entity,
        })
      }
      if (documents.length > 0) await this.api.push(token, documents)
      await clearItems(batch.map((b) => b.key))
      if (batch.length < 200) return
    }
  }

  private async pullChanges(token: string): Promise<void> {
    let meta = await this.meta()
    for (let guard = 0; guard < 50; guard++) {
      const result = await this.api.changes(token, meta.serverVersion)
      for (const doc of result.documents) {
        await this.applyRemote(doc.collection, doc.data, doc.updatedAt)
      }
      await this.saveMeta({ serverVersion: result.version })
      meta = await this.meta()
      if (!result.hasMore || result.documents.length === 0) return
    }
  }

  /** Записывает документ с сервера, если он свежее локального. */
  private async applyRemote(
    collection: SyncedCollection,
    data: Record<string, unknown>,
    updatedAt: string,
  ): Promise<void> {
    const table = db.table(collection)
    const id = String(data.id ?? '')
    if (!id) return
    const local = (await table.get(id)) as { updatedAt?: string } | undefined
    if (local?.updatedAt && local.updatedAt >= updatedAt) return
    // Пишем «как есть»: hooks очереди сработают, но следом мы уберём запись из outbox,
    // чтобы не отправлять серверу его же данные.
    await table.put(data)
    await db.outbox.delete(`${collection}:${id}`)
  }
}
