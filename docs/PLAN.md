# План работ

2026-10-30 · к ТЗ v2 (`docs/SPEC.md`)

Цель ближайших этапов — получить полный каталог плёночных камер в базе продукта и на нём проверить, что ядро действительно не зависит от категории. Приложение (соцсеть) строится поверх каталога после этого.

## Решения

| # | Вопрос | Статус |
|---|---|---|
| D1 | Стек конвейера | ✅ Python, `uv`, `httpx`, `pydantic`, `jsonschema`, `rapidfuzz`, `PyYAML`, `psycopg`, `pytest`, `ruff` |
| D2 | LLM для извлечения из текста | ⏳ Предложение: Claude через API (`claude-sonnet-5-5`), строгий JSON через tool use. Нужно к фазе 2 |
| D3 | Контакт для User-Agent | ⏳ Нужен адрес проекта (не личный). Нужен к фазе 1 |
| D4 | БД продукта | ✅ PostgreSQL + `pg_trgm` в Docker на своём сервере, без ORM |
| D5 | Как соблюдать ShareAlike | ⏳ Решает владелец после разведки |
| D6 | Git | ✅ Монорепозиторий, `raw/` и логи в `.gitignore` |
| D7 | Стек приложения | ✅ См. ниже |

## Стек приложения

Команда — владелец проекта и Claude. Сначала MVP на своём сервере и веб, мобильные клиенты — позже. Если продукт взлетит, приложение переезжает в Cloudflare.

| Слой | Выбор | Зачем |
|---|---|---|
| Сервер | Caddy на хосте (общий reverse proxy + TLS) → Docker Compose: Postgres, приложение, конвейер. Cloudflare DNS/CDN перед сервером | Наружу публикуется только порт приложения на `127.0.0.1`. Postgres доступен лишь во внутренней сети compose |
| БД | PostgreSQL + `pg_trgm` | Поиск по названиям и алиасам без отдельного сервиса. После переезда в Cloudflare база остаётся Postgres, приложение ходит к ней через Hyperdrive |
| Схема | `.sql` миграции в `db/migrations/`, применяет `dbmate` | Схема не принадлежит ни приложению, ни конвейеру |
| Работа с БД | Без ORM, чистый SQL: `postgres.js` в приложении, `psycopg` в конвейере | Сложные запросы (триграммный поиск, рекурсивный обход вариантов) пишутся как есть. Типы строк генерирует `kanel` из живой схемы после каждой миграции, вручную не пишутся. Текст SQL проверяется тестами против настоящего Postgres |
| Приложение | TypeScript + Nuxt (Vue) | Готовый HTML с сервера для публичных страниц каталога, чтобы их видели поисковики. Сборка под Node сейчас и под Cloudflare Workers потом |
| Авторизация | Better Auth, данные в нашем Postgres | Без внешнего сервиса |
| Файлы | Cloudflare R2 сразу (S3 API) | Фото пользователей и кэш каталожных превью. Для разработки — отдельный dev-бакет |
| Мобильные клиенты | Позже, через Capacitor | Переиспользует веб-приложение на Vue |
| Поиск позже | Meilisearch или Typesense | Когда `pg_trgm` перестанет хватать |

Граница между частями: конвейер (Python) пишет только в таблицы `catalog_*`, приложение владеет пользователями, коллекциями и правками. Общий контракт — схема БД, а не общий код.

## Фаза 0. Подготовка (≈0.5 дня)

- ✅ `git init`, `.gitignore`.
- Структура `pipeline/` из ТЗ (раздел 11), `pyproject.toml`, линтер, `pytest`, CLI-заготовка.
- `MODULE.md` для `film_cameras` по шаблону из приложения A: черновик scope, `attributes` и пилота. Источники и ID пока не заполняются — это задача разведки.

**Результат:** пустой, но запускаемый `run --category film_cameras --stage recon`.

## Фаза 1. Разведка плёночных камер → чекпоинт 1 (≈1 день)

Реальные запросы, ничего из памяти:

- **Wikidata:** класс плёночной камеры и его подклассы (найти QID и сверить по меткам), свойства производителя, дат, страны, байонета, типа плёнки, изображения. Число записей, доля с изображением, доля с меткой на английском и других языках.
- **Camera-wiki:** API, структура категорий (по производителю, по типу), шаблоны инфобоксов, число страниц моделей, лицензия и условия, robots.txt.
- **Commons:** формат `imageinfo`/`extmetadata` для лицензии и автора.
- Поискать другие открытые источники камер (с проверкой лицензии) и записать, что нашлось и почему подходит или не подходит.
- Перекрёстные ссылки: есть ли в Wikidata свойство, ссылающееся на Camera-wiki, и как часто оно заполнено.
- Оценка объёма и времени выкачки при 1 запросе в секунду.

**Чекпоинт 1:** отчёт `categories/film_cameras/RECON.md` → подтверждение владельца + решение D5.

## Фаза 2. Ядро (≈3–4 дня)

Параллельно с ожиданием чекпоинта 1 можно начать то, что от него не зависит:

- Общая схема: pydantic-модели записи, связи и реестра, генерация JSON Schema, валидатор `attributes` по схеме модуля.
- HTTP-слой: User-Agent, лимит скорости на источник, `Retry-After`, сохранение сырых ответов, возобновление.
- Адаптеры: `wikidata_sparql`, `mediawiki_api` (с ревизиями и `maxlag`), `commons_imageinfo`, `user_edits` (пока читает пустой файл).
- Реестр ID (раздел 4): присвоение, конфликты, слияния, осиротевшие записи. Это самая важная часть, на неё — основные тесты.
- Нормализация и ключ поиска (3.2), дедуп (этап 6), сборка с приоритетами и лицензиями (этап 7).
- LLM-извлечение с кэшем (раздел 9).
- Отчёты: `REPORT.md`, `diff.md`, файлы `review/`.

**Результат:** этапы 1–8 работают на тестовых фикстурах, тесты на реестр ID и воспроизводимость проходят.

## Фаза 3. Модуль `film_cameras` и пилот → чекпоинт 2 (≈2 дня)

- `config.yaml`, `attributes.schema.json` (тип камеры, формат плёнки, байонет, затвор, экспонометр и т.д. — уточняется по разведке), словарь алиасов производителей.
- Правила «модель или вариант» для камер.
- Прогон на пилоте: 2–3 производителя разного типа. Предложение: Nikon (много вариантов), Zenit/KMZ (кириллица, транслитерации, экспортные имена), Polaroid или Kodak (непрофессиональные модели, другой тип данных).

**Чекпоинт 2:** пилотная таблица, статистика сопоставления, 10 спорных случаев.

## Фаза 4. Полный прогон → чекпоинт 3 (≈1–2 дня + время выкачки)

- Полная выкачка, разбор, ручная проверка 30 записей.
- Повторный прогон на сохранённых `raw/` для проверки воспроизводимости и стабильности ID.

**Чекпоинт 3:** файлы категории, `REPORT.md`, `diff.md`, чек-лист приёмки.

## Фаза 5. Публикация в БД (≈2 дня)

- Схема PostgreSQL: `catalog_entries`, `catalog_relations`, `catalog_id_registry`, `catalog_aliases`, `catalog_edits`, а также заготовка `items` (слой экземпляров, раздел 5).
- Этап 9: upsert без удалений, поисковые индексы.
- Синхронизация реестра ID: БД становится мастер-копией.

**Результат:** каталог камер в БД, по нему работает поиск по любому названию.

## Фаза 6. Вторая категория — проверка ядра (≈2–3 дня)

Берём категорию, максимально непохожую на камеры, чтобы проверить ядро всерьёз. Например, коллекционные карточки через `rest_api` (сеты, номера в сете, связь «карта входит в сет»). Если для неё пришлось менять код этапов, ядро дорабатывается, а это фиксируется как урок.

Объективы к камерам — естественное продолжение (связь «подходит к байонету»), но для проверки ядра это слишком похожий случай. Их лучше делать третьей категорией.

## Дальше: приложение (отдельный план)

Поверх каталога: аккаунты и профили → своя коллекция и вишлист (слой экземпляров) → поиск владельцев модели → правки каталога с модерацией → лента, подписки, сообщения. Отдельный план составим после фазы 5.

Решено 2026-10-31:

- **Сделок на платформе нет.** Ни оплаты, ни маркетплейса, только связь между людьми.
- **Внутренний чат — в очереди.** Личные сообщения между пользователями: из карточки владельца, с блокировкой и жалобами. Делается после поиска владельцев.
- **Аккаунты открытые и закрытые.** Имя — любой никнейм, реальное имя не требуется. Местоположение необязательно.
- **EXIF удаляем** с фото экземпляров при загрузке, чтобы GPS-координаты не утекали.

## Риски

- **Покрытие источников окажется скромным**, особенно для недорогих и региональных моделей. Узнаем на разведке. Компенсируем правками пользователей.
- **ShareAlike-источник даёт значительную часть данных.** Решение D5 влияет на то, что продукт сможет показывать.
- **Ошибки сопоставления.** Склеенные разные модели хуже дублей: на склейку пользователи начнут ссылаться. Поэтому всё неочевидное уходит в review, а не склеивается автоматически.

## Rarity rating (agreed 2026-10-31)

Our own rating, shown on the model page with a public "How it's rated" page (`/about/rarity`).

1. **Now: production only.** Five levels per category; thresholds live in `rarity_scales` (DB), not in code. Range → middle; no figure → "Not rated"; a variant is rated on its own production only.
2. **With collections:** adjust by up to ±1 level by how often a model turns up among collectors here, only past a minimum number of owners in the category. Demand (want/own) is a separate metric, not rarity.
3. **Maybe:** market frequency via official APIs only, after checking their terms.

Thresholds and manual overrides (with a visible reason) are edited in the **admin panel**, which comes with accounts and roles. Until then: `update rarity_scales set levels = ... where category = ...`.

## App: first release (agreed 2026-10-31)

Built and deployed together; the deploy follows the English app's `deploy.sh` pattern.

1. **Accounts.** Email + password and Google (no Apple). Username = public address `/u/name`, display name optional, avatar, bio, optional city, open/closed account. Account deletion and data export. Email sending is stubbed: verification and password reset show "coming soon" until a mail provider is chosen.
2. **Collection and wishlist.** Copies per SPEC section 5; two-step add (pick model, then the copy editor, same screen for editing); "I own / I want" on the model page.
3. **Copy photos.** Up to 12, cover and order, stored in R2 (keys as placeholders in `.env`), EXIF stripped, previews generated. Public only after moderation; a copy without photos stays a draft.
4. **Public profiles and owner search.** `/u/name` with status filters, copy page, owners on the model page.
5. **Admin panel.** Roles, photo moderation, reports and blocks, rarity thresholds.
6. **Chat.** Full direct messaging: conversations, real-time delivery, unread state, block and report.
7. **User catalog edits.** Suggest an edit / a new model, moderated; approved edits feed the pipeline as `user_edit`.
8. **Legal pages.** Terms, privacy, photo rules, sources and licenses.

After launch: follows and feed, "Shots" (frames taken with a camera), mobile tab bar.
