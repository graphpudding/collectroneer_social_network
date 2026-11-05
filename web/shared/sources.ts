// Numbered source list for a model page: superscripts on spec rows point into it.
import type { CatalogEntry } from "./catalog";

type Known = { key: string; host: string; name: string; license?: string };

const KNOWN: Known[] = [
  { key: "wikidata", host: "www.wikidata.org", name: "Wikidata", license: "CC0" },
  { key: "enwiki", host: "en.wikipedia.org", name: "Wikipedia", license: "CC BY-SA 4.0" },
  { key: "ruwiki", host: "ru.wikipedia.org", name: "Wikipedia (ru)", license: "CC BY-SA 4.0" },
  { key: "commons", host: "commons.wikimedia.org", name: "Wikimedia Commons" },
  { key: "camerawiki", host: "camera-wiki.org", name: "Camera-wiki", license: "GFDL 1.3" },
  { key: "canon", host: "global.canon", name: "Canon Camera Museum" },
  { key: "zenitcamera", host: "www.zenitcamera.com", name: "zenitcamera.com" },
];

export type SourceItem = {
  no: number;
  key: string;
  name: string;
  /** What exactly was cited: a Wikidata ID, an article or file title. */
  detail: string;
  url: string;
  license?: string;
};

const WIKIS = new Set(["wikidata", "enwiki", "ruwiki", "commons", "camerawiki"]);

function detailOf(url: URL, key: string) {
  const title = url.searchParams.get("title") ?? decodeURIComponent(url.pathname.split("/").pop() ?? "");
  if (key === "commons") return title.replace(/^File:/, "").replace(/_/g, " ");
  if (key === "wikidata") return title;
  if (WIKIS.has(key)) return title.replace(/_/g, " ");
  return url.hostname.replace(/^www\./, "") + url.pathname.replace(/\/$/, "");
}

export function sourceList(entry: Pick<CatalogEntry, "source_urls">): SourceItem[] {
  return entry.source_urls.map((raw, i) => {
    const url = new URL(raw);
    const known = KNOWN.find((k) => k.host === url.hostname);
    // Unknown hosts are keyed by host name, as the pipeline writes them in field_sources.
    const key = known?.key ?? url.hostname.replace(/^www\./, "");
    return {
      no: i + 1,
      key,
      name: known?.name ?? url.hostname.replace(/^www\./, ""),
      detail: detailOf(url, key),
      url: raw,
      license: known?.license,
    };
  });
}

/** Source number for a field ("attributes.lens_mount", "country"), if the record says where it came from. */
export function sourceNo(
  entry: Pick<CatalogEntry, "field_sources">,
  sources: SourceItem[],
  field: string,
) {
  // "camerawiki_llm": extracted by the pipeline from that source's page, numbered as the source.
  const key = entry.field_sources[field]?.replace(/_llm$/, "");
  return key ? sources.find((s) => s.key === key)?.no : undefined;
}

/** Short list of source names for the collapsed Sources row: "Wikidata, Wikipedia, Commons". */
export const sourceNames = (sources: SourceItem[]) =>
  [...new Set(sources.map((s) => s.name.replace("Wikimedia ", "")))].join(", ");
