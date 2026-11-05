# film_cameras: camera-wiki import, run camerawiki-dump-20261031

Source: `cameras.sqlite`. Records: **5547**, variant relations: 4, excluded: 138 (`review/excluded.csv`), ID conflicts: 0 (`review/id_conflicts.csv`).

## Fields

ok = normalised from structured fields; llm = extracted from the article text with a verified quote; raw = the source has text we could not normalise yet (`gaps_raw.csv`); missing = nothing in the source.

| Field | ok | llm | raw | missing | |
|---|---:|---:|---:|---:|---:|
| year_start | 3460 | 482 | 5 | 1599 | 71% filled |
| year_end | 475 | 595 | 0 | 4476 | 19% filled |
| country | 606 | 993 | 0 | 3947 | 28% filled |
| production_count | 39 | 210 | 0 | 5297 | 4% filled |
| image | 5 | 0 | 0 | 5541 | 0% filled |
| camera_type | 4229 | 698 | 0 | 619 | 88% filled |
| film_format | 4632 | 544 | 8 | 362 | 93% filled |
| frame_size | 158 | 1307 | 1 | 4080 | 26% filled |
| lens | 1331 | 2180 | 29 | 2006 | 63% filled |
| shutter_type | 520 | 716 | 357 | 3953 | 22% filled |
| shutter_speeds | 873 | 1564 | 10 | 3099 | 43% filled |
| metering | 330 | 622 | 42 | 4552 | 17% filled |
| exposure_modes | 111 | 499 | 6 | 4930 | 10% filled |
| focus | 510 | 1609 | 17 | 3410 | 38% filled |
| power | 570 | 864 | 0 | 4112 | 25% filled |

Country hints (not used as values): 3259 records have a guess from the brand's nationality or factory timeline, in the `country_hint` column of `gaps.csv`.

## Same display name

- canonsureshotowl: 2
- fujifilmdl100: 2
- wirginedixa: 2
- rollei35rf: 2

## User edits

Replayed from `user_edits.jsonl`: 0 edits, 0 new models, 0 merges.
