import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { ResearchProviderError } from "../src/modules/research/index.ts";
import { parseXmlRiverSerp, parseXmlRiverSuggestions, parseXmlRiverWordstat, XmlRiverClient } from "../src/modules/research/worker.ts";
import { createLogger } from "../src/platform/observability/logger.ts";

const serp = `<?xml version="1.0" encoding="utf-8"?>
<yandexsearch><response><results><grouping><group><doc><url>https://www.example.ru/page</url><title>Пример</title><passages><passage>Описание результата</passage></passages></doc></group></grouping></results><topads><query><url>ads.example.ru</url><title>Реклама</title><snippet>Предложение</snippet></query></topads><addresults><relatedSearches><query><title>похожий запрос</title></query></relatedSearches></addresults></response></yandexsearch>`;

describe("XmlRiverClient", () => {
  it("normalizes organic and related Yandex evidence", () => {
    expect(parseXmlRiverSerp(serp)).toEqual([
      { type: "organic", url: "https://www.example.ru/page", domain: "example.ru", title: "Пример", snippet: "Описание результата" },
      { type: "ad", url: "ads.example.ru", domain: "ads.example.ru", title: "Реклама", snippet: "Предложение" },
      { type: "related", url: null, domain: null, title: "похожий запрос", snippet: null },
    ]);
  });

  it("normalizes Yandex suggestions", () => {
    expect(parseXmlRiverSuggestions({ phrases: ["купить квартиру", " купить дом "] })).toEqual(["купить квартиру", "купить дом"]);
  });

  it("rejects XML entity declarations before parsing", () => {
    expect(() => parseXmlRiverSerp('<!DOCTYPE x [<!ENTITY secret SYSTEM "file:///etc/passwd">]><x>&secret;</x>')).toThrowError(expect.objectContaining({ code: "PROVIDER_INVALID_RESPONSE" }));
  });

  it("normalizes bounded Wordstat values", () => {
    expect(parseXmlRiverWordstat({ popular: [{ text: "купить квартиру", value: "12 345" }], associations: [{ text: "новостройки", value: "900", isAssociations: true }] })).toEqual([
      { phrase: "купить квартиру", monthlyCount: 12345, association: false },
      { phrase: "новостройки", monthlyCount: 900, association: true },
    ]);
  });

  it("never retries an ambiguous paid timeout", async () => {
    let calls = 0;
    const client = new XmlRiverClient({ user: "user", key: "secret" }, async () => { calls += 1; throw new Error("timeout"); });
    await expect(client.collectYandexSerp({ query: "test" })).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT_AMBIGUOUS", category: "AMBIGUOUS_AFTER_DISPATCH" });
    expect(calls).toBe(1);
  });

  it("marks an explicit provider rejection as definitely not charged only for HTTP 429", async () => {
    const rateLimited = new XmlRiverClient({ user: "user", key: "secret" }, async () => new Response("", { status: 429, headers: { "Retry-After": "12" } }));
    await expect(rateLimited.collectYandexSerp({ query: "test" })).rejects.toMatchObject({ category: "DEFINITELY_NOT_CHARGED", retryAfterMs: 12_000 });

    const serverFailure = new XmlRiverClient({ user: "user", key: "secret" }, async () => new Response("", { status: 503 }));
    await expect(serverFailure.collectYandexSerp({ query: "test" })).rejects.toMatchObject({ category: "AMBIGUOUS_AFTER_DISPATCH" });
  });

  it("keeps credentials and the full provider URL out of every client error branch and logs", async () => {
    const user = "xmlriver-user-private-2841";
    const key = "xmlriver-key-private-9274";
    const query = "private-query-marker-5813";
    const capturedUrls: string[] = [];
    const scenarios: Array<() => Promise<unknown>> = [];

    const withResponse = (response: Response, operation: "serp" | "suggestions" | "wordstat" = "serp") => {
      const client = new XmlRiverClient({ user, key }, async (input) => {
        capturedUrls.push(String(input));
        return response;
      });
      const request = { query };
      if (operation === "suggestions") return () => client.collectYandexSuggestions(request);
      if (operation === "wordstat") return () => client.collectWordstat(request);
      return () => client.collectYandexSerp(request);
    };

    const networkClient = new XmlRiverClient({ user, key }, async (input) => {
      capturedUrls.push(String(input));
      throw new Error(`transport failed for ${String(input)}`);
    });
    scenarios.push(() => networkClient.collectYandexSerp({ query }));
    for (const status of [400, 408, 429, 503]) {
      scenarios.push(withResponse(new Response("", { status })));
    }
    scenarios.push(withResponse(new Response("", { headers: { "content-length": "2000001" } })));
    scenarios.push(withResponse(new Response(new Uint8Array(2_000_001))));
    scenarios.push(withResponse(new Response("not xml")));
    scenarios.push(withResponse(new Response("not-json"), "suggestions"));
    scenarios.push(withResponse(new Response("not-json"), "wordstat"));

    const failures: ResearchProviderError[] = [];
    for (const scenario of scenarios) {
      try {
        await scenario();
        throw new Error("Expected XMLRiver scenario to fail");
      } catch (error) {
        expect(error).toBeInstanceOf(ResearchProviderError);
        failures.push(error as ResearchProviderError);
      }
    }

    let output = "";
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = createLogger({ scope: "xmlriver-error-proof" }, destination);
    failures.forEach((error, index) => {
      logger.error({
        err: error,
        mislabeledContext: capturedUrls[index],
        providerUrl: capturedUrls[index],
      }, "XMLRiver request failed");
    });

    for (const error of failures) {
      const serialized = JSON.stringify(error);
      expect(error.message).toBe(error.code);
      expect(String(error)).not.toContain(user);
      expect(String(error)).not.toContain(key);
      expect(serialized).not.toContain(user);
      expect(serialized).not.toContain(key);
      expect(serialized).not.toContain(query);
    }
    for (const forbidden of [user, key, query, encodeURIComponent(user), encodeURIComponent(key), encodeURIComponent(query)]) {
      expect(output).not.toContain(forbidden);
    }
  });
});
