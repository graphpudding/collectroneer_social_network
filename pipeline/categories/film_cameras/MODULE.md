# Модуль категории: плёночные камеры

Черновик к фазе 0 · 2026-10-30. Разделы 3 и 7 заполняются по итогам разведки (чекпоинт 1). Всё остальное — предложения, которые уточняются на пилоте.

## 1. Ключ и определение

`film_cameras` — модель фотоаппарата для неподвижных изображений, снимающая на светочувствительный фотоматериал: плёнку, пластины, листовую или моментальную плёнку.

## 2. Scope

**Входит:** малоформатные (135), среднеформатные (120/220/620/127), крупноформатные и карданные, моментальные (Polaroid, Instax и т.п.), субминиатюрные, 110/126/APS, дисковые, панорамные, стереокамеры, фотоаппараты на пластинах, ящичные и складные камеры.

**Не входит:** цифровые камеры, киносъёмочные камеры (возможная отдельная категория), объективы и аксессуары (отдельные категории), задники и плёнки как товар.

**Пограничные случаи** — решаются на пилоте, а до решения идут в `review/scope_unsure.csv`:

- одноразовые камеры (single-use);
- гибриды плёнка/цифра;
- цифровые задники к плёночным камерам;
- игрушечные камеры, пинхол-камеры, самоделки.

**Проверочные запросы.** Должны найтись: Nikon F, Nikon FM2, Leica M3, Canon AE-1, Pentax K1000, Zenit-E, Zorki-4, Kiev-88, Hasselblad 500C/M, Rolleiflex 2.8F, Polaroid SX-70, Olympus Trip 35, Kodak Brownie. Не должны найтись: Nikon D3, Leica M9, Bolex H16.

## 3. Источники

- **Camera-wiki, дамп** (`db/cameras.sqlite`, schema_version 2, собран 2026-10-31; в git не лежит). Основа каталога: 5 684 карточки, полный викитекст статей, evidence по полям. Текст под GFDL 1.3: берём факты со ссылкой на ревизию страницы, статьи не копируем. Фото из дампа не используем: это Flickr-снимки с разрешением только для camera-wiki. Импорт: `uv run catalog import-camerawiki ../db/cameras.sqlite --sample ../db/seed/film_cameras.sample.json` → `catalog.json`, `gaps.csv`, `gaps_raw.csv`, `REPORT.md`, `review/`.
- **В том же дампе:** официальный индекс Canon Camera Museum (252 модели) и таблица выпуска КМЗ с zenitcamera.com (тиражи, только КМЗ).
- **Дальше:** Wikidata (`wikidata_sparql`) и Wikimedia Commons (`commons_imageinfo`) для фото и идентификаторов, `user_edits`. Сам сайт camera-wiki напрямую не обходим.

## 4. Смысл полей ядра

- `maker` — бренд на камере (`Nikon`, `Zenit`). Завод или концерн, если отличается от бренда (KMZ для Zenit, Arsenal для Kiev), — в `attributes.manufacturer`.
- `year_start` / `year_end` — годы выпуска модели, а не анонса.
- `country` — страна производства. Исторические государства (USSR, East Germany, West Germany) сохраняются как есть.
- `production_count` — тираж модели.

## 5. Схема `attributes` (черновик)

| Поле | Тип | Значения / единицы |
|---|---|---|
| `camera_type` | enum | `slr`, `rangefinder`, `tlr`, `viewfinder`, `point_and_shoot`, `instant`, `view_camera`, `press`, `folding`, `box`, `panoramic`, `stereo`, `subminiature`, `single_use`, `pinhole`. Одно значение; если источник даёт несколько, берётся первое по порядку `slr, tlr, instant, folding, rangefinder, box, single_use, pinhole, point_and_shoot, viewfinder` |
| `film_format` | enum[] | `135`, `120`, `220`, `620`, `127`, `110`, `126`, `aps`, `disc`, `sheet`, `plate`, `instant_*` (конкретные системы) |
| `frame_size` | string | `24x36`, `6x6`, `half_frame` и т.д. |
| `lens_mount` | string | Байонет или резьба (`Nikon F`, `M42`). Пусто, если объектив несъёмный |
| `fixed_lens` | string | Объектив несъёмной камеры |
| `shutter_type` | enum | `focal_plane` (материал не указан), `focal_plane_cloth`, `focal_plane_metal`, `leaf`, `other` |
| `shutter_speeds` | object | `{fastest: "1/4000", slowest: "1", bulb: true}` |
| `metering` | enum | `none`, `built_in` (встроенный, не через объектив, например селеновый), `ttl`, `ttl_otf` |
| `exposure_modes` | enum[] | `manual`, `aperture_priority`, `shutter_priority`, `program` |
| `focus` | enum | `manual`, `autofocus`, `zone`, `fixed` |
| `power` | string | Батарейка или «механическая» |
| `manufacturer` | string[] | Заводы или концерны, если отличаются от `maker` (у Зенит-Е их два: КМЗ и БелОМО) |
| `serial_ranges` | object[] | `{from, to, year, variant, source}`, только если есть в источниках |

**`condition` для экземпляров:** `mint`, `near_mint`, `excellent`, `very_good`, `good`, `fair`, `for_parts`.

## 6. Модель / вариант

- Своё название или номер модели (FM2 → FM2n, AE-1 → AE-1 Program) → отдельная запись с `variant_of`.
- Одна модель под разными названиями на разных рынках → алиасы одной записи.
- Отделка (black / chrome) → отдельный вариант, только если источники описывают её отдельно. Иначе это свойство экземпляра.

## 7. Правила разбора

Заполняется после разведки: свойства Wikidata, поля инфобокса Camera-wiki, сопоставление их схеме. Для LLM-извлечения кандидаты — `production_count`, `shutter_speeds`, `metering`, `serial_ranges`.

## 8. Нормализация

Словарь алиасов `maker`: `Asahi Pentax` / `Asahi Optical` → `Pentax`, `Nippon Kogaku` → `Nikon`, `Зенит` / `Zenith` → `Zenit` и т.п. (дополняется по данным). Транслитерации кириллицы (`Zorki` / `Zorkiy` / `Zorky`) и японские названия идут в `aliases` и `labels`.

## 9. Приоритеты источников

`user_edit` > записи, проверенные вручную (`db/seed/film_cameras.sample.json`) > Camera-wiki (дамп) > Wikidata > `*_llm`. Для `external_ids` и `labels` выше всех Wikidata. Страна из категорий camera-wiki («Japanese 35mm SLR») — это национальность бренда, а не страна выпуска: она идёт подсказкой в `gaps.csv`, а не значением.

## 10. Пилот

Nikon (много вариантов), KMZ / Zenit (кириллица, транслитерации, экспортные имена), Polaroid (моментальные камеры, другие форматы плёнки).
