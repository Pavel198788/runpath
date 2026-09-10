# RunPath — PWA «от дивана до марафона»

Local-first приложение на русском, ведёт новичка от первой прогулки до марафона.
Полное ТЗ: `docs/SPEC.md`. Roadmap и текущий этап: `docs/ROADMAP.md`. Пошаговый бэклог: `docs/BACKLOG.md`. Статус фич: `docs/FEATURES.md`.

## Стек

- Vite 8 + React 19 + TypeScript 5.9 (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- PWA: `vite-plugin-pwa` (Workbox, `registerType: 'prompt'`)
- Состояние: Zustand (только UI), Dexie 4 / IndexedDB (все пользовательские данные)
- Стили: Tailwind v4 (токены в `src/styles/index.css`), свои компоненты в `src/ui/`
- Роутинг: react-router v7, экраны лениво (`lazy`)
- i18n: i18next, строки в `src/i18n/locales/ru/common.json`
- Даты: date-fns (`ru`); графики: Recharts (с A1); карты: Leaflet + OSM (с A2)
- Тесты: Vitest + Testing Library + fake-indexeddb
- Качество: ESLint 10 (flat), Prettier, husky + lint-staged, GitHub Actions

## Команды

```
npm run dev          # dev-сервер клиента
npm run check        # typecheck + lint + test + build — прогонять перед коммитом
npm run test:watch   # тесты в watch-режиме
npm run icons        # перегенерировать иконки PWA
npm run format       # prettier
npm run e2e          # Playwright: офлайн-режим и онбординг (нужен собранный dist)

# сервер (из папки server/)
composer install
vendor/bin/phpunit                      # тесты API
vendor/bin/phinx migrate -e production  # миграции базы
```

## Сборка с сервером и без

Без переменных окружения приложение автономно: аккаунтов нет, всё на устройстве.
С сервером: `VITE_API_URL=https://домен/api/public VITE_FEATURE_SERVER=true npm run build`.

## Структура

```
src/domain/     чистая логика без React и БД (план, адаптация, ACWR, питание, парсеры, калькуляторы). Полностью в тестах.
src/data/       Dexie-схема (db.ts), сущности (entities/), репозитории
src/features/   UI по фичам: today, plan, progress, more, onboarding, …
src/ui/         дизайн-система (Button, Card, Page, Segmented …)
src/app/        App, router, layout (AppShell, BottomNav, OfflineBanner, UpdatePrompt)
src/store/      Zustand — только UI-состояние (тема)
src/i18n/       переводы
src/sync/       интерфейс синхронизации; сейчас NoopSync, ServerSync — этап B
src/ai/         провайдеры ИИ (byok — A5, proxy — B2), промты, сборка контекста
src/integrations/ провайдеры импорта (файлы — A2, Strava/Garmin — B3)
src/config/     features.ts (флаги), app.ts (константы)
content/        обучающие материалы, рецепты, продукты, упражнения (JSON/MD, валидируются zod)
docs/           ROADMAP, FEATURES, IDEAS, PHYSIOLOGY, adr/
server/         PHP-бэкенд (Slim 4): public/ (точка входа и админка), src/ (контроллеры, сервисы),
                migrations/ (Phinx), cron/ (фоновые задания), tests/ (PHPUnit). Установка — server/README.md
```

## Соглашения

- Все строки интерфейса — через `t('...')`, ничего не хардкодить в JSX.
- Внутри данных всё в метрах и секундах, ISO-даты строками; единицы — только при отображении (`src/domain/units`).
- Каждая сущность расширяет `BaseEntity` (`id` UUID, `createdAt`, `updatedAt`, `deletedAt`, `syncVersion`). Удаление — мягкое.
- Запись в БД только через репозитории (`src/data/repositories`), которые обновляют `updatedAt`.
- Компоненты экранов — `export default` (для lazy), всё остальное — именованные экспорты.
- Комментарии — короткие, по-русски, отвечают на «зачем», не на «что».
- Кнопки и тап-зоны ≥ 44px; mobile-first; светлая и тёмная темы обязательны.

## Не делать

- Не тащить на сервер логику, которая должна работать офлайн. Любой экран, кроме входа/синхронизации/ИИ/интеграций, обязан работать в авиарежиме.
- Не хардкодить строки в коде.
- Не редактировать выпущенные версии Dexie-схемы — только добавлять `version(N+1)` с `upgrade`. То же для MySQL-миграций на этапе B.
- Не менять правила безопасности плана (`docs/PHYSIOLOGY.md`) без обновления тестов в `src/domain/`.
- Не импортировать React/БД/UI из `src/domain/` (ESLint это проверяет).
- Никаких секретов в репозитории: ключи — только в `.env` (клиентские `VITE_*` — только флаги, не секреты).
- Не делать сервер обязательным: без `VITE_API_URL` приложение собирается полностью автономным, и так и должно оставаться.
- В `composer.json` зафиксирована платформа PHP 8.2 (`config.platform.php`) — как на shared-хостинге. Не убирать, иначе пакеты подтянутся под более новый PHP и не встанут на хостинге.
- Не выдавать за работающее то, что PWA не может (фоновый GPS на iOS при заблокированном экране, push без сервера) — честно описывать ограничение.

## Процесс

Одна фаза — одна итерация: рабочая сборка, зелёный `npm run check`, коммит, короткий отчёт (сделано / отложено / что проверить руками). Идеи «не сейчас» — в `docs/IDEAS.md`.
