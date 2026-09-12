import { describe, expect, it } from "vitest";
import { parseXmlRiverSerp, parseXmlRiverSuggestions, parseXmlRiverWordstat, XmlRiverClient } from "../src/modules/research/worker.ts";

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
    const rateLimited = new XmlRiverClient({ user: "user", key: "secret" }, async () => new Response("", { status: 429 }));
    await expect(rateLimited.collectYandexSerp({ query: "test" })).rejects.toMatchObject({ category: "DEFINITELY_NOT_CHARGED" });

    const serverFailure = new XmlRiverClient({ user: "user", key: "secret" }, async () => new Response("", { status: 503 }));
    await expect(serverFailure.collectYandexSerp({ query: "test" })).rejects.toMatchObject({ category: "AMBIGUOUS_AFTER_DISPATCH" });
  });
});
