import { XMLParser } from "fast-xml-parser";
import type { ResearchProvider, ResearchProviderRequest, SearchEvidence, WordstatEvidence } from "../application/ports/research-provider.ts";
import { ResearchProviderError } from "../application/ports/research-provider.ts";

const MAX_RESPONSE_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 12_000;

interface XmlRiverCredentials { user: string; key: string }
type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | null { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null; }
function array(value: unknown): unknown[] { return value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]; }
function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const record = object(value); return record ? text(record["#text"] ?? record.text ?? record.title ?? "") : "";
}
function domainOf(value: string): string | null { try { return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; } }

async function boundedBody(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_RESPONSE_BYTES) throw new ResearchProviderError("PROVIDER_RESPONSE_TOO_LARGE", "AMBIGUOUS_AFTER_DISPATCH");
  if (!response.body) return "";
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength; if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new ResearchProviderError("PROVIDER_RESPONSE_TOO_LARGE", "AMBIGUOUS_AFTER_DISPATCH"); }
    chunks.push(value);
  }
  const body = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(body);
}

export function parseXmlRiverSerp(xml: string): SearchEvidence[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new ResearchProviderError("PROVIDER_INVALID_RESPONSE", "AMBIGUOUS_AFTER_DISPATCH");
  const parsed = new XMLParser({ ignoreAttributes: false, processEntities: false, trimValues: true }).parse(xml) as JsonObject;
  const response = object(object(parsed.yandexsearch)?.response);
  if (!response || response.error) throw new ResearchProviderError("PROVIDER_INVALID_RESPONSE", "AMBIGUOUS_AFTER_DISPATCH");
  const grouping = object(object(response.results)?.grouping);
  const organic = array(grouping?.group).flatMap((group): SearchEvidence[] => {
    const document = object(object(group)?.doc); if (!document) return [];
    const url = text(document.url); const title = text(document.title);
    if (!url || !title) return [];
    const passages = object(document.passages);
    const snippet = array(passages?.passage).map(text).filter(Boolean).join(" ") || null;
    return [{ type: "organic", url, domain: domainOf(url), title, snippet }];
  });
  const addResults = object(response.addresults ?? object(parsed.yandexsearch)?.addresults);
  const relatedContainer = object(addResults?.relatedSearches);
  const related = array(relatedContainer?.query).map(text).filter(Boolean).map((title): SearchEvidence => ({ type: "related", url: null, domain: null, title, snippet: null }));
  const ads = [response.topads, response.bottomads, response.rightads].flatMap((container): SearchEvidence[] =>
    array(object(container)?.query).flatMap((entry) => {
      const row = object(entry); if (!row) return [];
      const url = text(row.url); const title = text(row.title); if (!title) return [];
      return [{ type: "ad", url: url || null, domain: url ? domainOf(url) : null, title, snippet: text(row.snippet) || null }];
    }),
  );
  return [...organic, ...ads, ...related];
}

export function parseXmlRiverSuggestions(payload: unknown): string[] {
  const root = object(payload); if (!root || root.code || root.error) throw new ResearchProviderError("PROVIDER_INVALID_RESPONSE", "AMBIGUOUS_AFTER_DISPATCH");
  return array(root.phrases).map(text).filter(Boolean).slice(0, 200);
}

export function parseXmlRiverWordstat(payload: unknown): WordstatEvidence[] {
  const root = object(payload); if (!root || root.code || root.error) throw new ResearchProviderError("PROVIDER_INVALID_RESPONSE", "AMBIGUOUS_AFTER_DISPATCH");
  const candidates = [root.popular, root.associations, object(root.content)?.includingPhrases, object(root.content)?.phrasesAssociations];
  const output: WordstatEvidence[] = [];
  for (const [index, candidate] of candidates.entries()) {
    const record = object(candidate); const items = array(record?.items ?? record?.data ?? candidate);
    for (const item of items) {
      const row = object(item); if (!row) continue; const phrase = text(row.text ?? row.phrase); if (!phrase) continue;
      const rawCount = text(row.value ?? row.number).replace(/\s+/g, ""); const count = /^\d+$/.test(rawCount) ? Number(rawCount) : null;
      output.push({ phrase, monthlyCount: count, association: index === 1 || index === 3 || row.isAssociations === true });
    }
  }
  return output.slice(0, 200);
}

export class XmlRiverClient implements ResearchProvider {
  constructor(private readonly credentials: XmlRiverCredentials, private readonly fetcher: typeof fetch = fetch) {
    if (!credentials.user.trim() || !credentials.key.trim()) throw new ResearchProviderError("PROVIDER_CONFIGURATION_MISSING", "NON_RETRYABLE");
  }

  private async request(path: string, request: ResearchProviderRequest, format: "xml" | "json", options?: { setab?: string; additional?: string; body?: string }) {
    const url = new URL(path, "https://xmlriver.com");
    url.searchParams.set("user", this.credentials.user); url.searchParams.set("key", this.credentials.key); url.searchParams.set("query", request.query);
    if (request.regionId) url.searchParams.set(path.includes("wordstat") ? "regions" : "lr", String(request.regionId));
    if (format === "xml") url.searchParams.set("format", "xml");
    if (options?.setab) url.searchParams.set("setab", options.setab);
    if (options?.additional) url.searchParams.set("additional", options.additional);
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;
    let response: Response;
    try { response = await this.fetcher(url, { method: options?.body ? "POST" : "GET", body: options?.body, signal, headers: { Accept: format === "xml" ? "application/xml,text/xml" : "application/json", ...(options?.body ? { "Content-Type": "application/json" } : {}), ...(request.correlationId ? { "X-Correlation-ID": request.correlationId } : {}) } }); }
    catch { throw new ResearchProviderError("PROVIDER_TIMEOUT_AMBIGUOUS", "AMBIGUOUS_AFTER_DISPATCH"); }
    if (!response.ok) {
      const category = response.status === 429
        ? "DEFINITELY_NOT_CHARGED"
        : response.status === 408 || response.status >= 500
          ? "AMBIGUOUS_AFTER_DISPATCH"
          : "NON_RETRYABLE";
      throw new ResearchProviderError("PROVIDER_REJECTED", category);
    }
    return boundedBody(response);
  }

  async collectYandexSerp(request: ResearchProviderRequest) { return parseXmlRiverSerp(await this.request("/search_yandex/xml", request, "xml", { additional: "y_topads,y_bottomads,rs_y" })); }
  async collectYandexSuggestions(request: ResearchProviderRequest) {
    const body = await this.request("/search_yandex/xml", request, "json", { setab: "tips", body: JSON.stringify({ phrases: [request.query] }) });
    try { return parseXmlRiverSuggestions(JSON.parse(body)); } catch (error) { if (error instanceof ResearchProviderError) throw error; throw new ResearchProviderError("PROVIDER_INVALID_RESPONSE", "AMBIGUOUS_AFTER_DISPATCH"); }
  }
  async collectWordstat(request: ResearchProviderRequest) { const body = await this.request("/wordstat/new/json", request, "json"); try { return parseXmlRiverWordstat(JSON.parse(body)); } catch (error) { if (error instanceof ResearchProviderError) throw error; throw new ResearchProviderError("PROVIDER_INVALID_RESPONSE", "AMBIGUOUS_AFTER_DISPATCH"); } }
  async getProviderHealth() { return { available: true, code: "CONFIGURED" }; }
}
