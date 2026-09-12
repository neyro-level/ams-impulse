import { afterEach, describe, expect, it, vi } from "vitest";
import { sendLead } from "../src/shared/leads/send-lead.ts";

const payload = {
  name: "Тест",
  phone: "+79990000000",
  source: "https://impulse.ams24.ru/",
  honeypot: "",
  openedAt: 1,
  utm: {},
  consent: {
    acceptedAt: "2026-09-12T10:00:00.000Z",
    scope: "lead_response" as const,
  },
};

describe("AMS Leads API configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects an untrusted endpoint before sending lead PII", async () => {
    vi.stubEnv("NEXT_PUBLIC_LEADS_API_URL", "https://attacker.example/api/leads");
    vi.stubEnv("NEXT_PUBLIC_LEADS_PROJECT_ID", "ams-impulse");
    vi.stubEnv("NEXT_PUBLIC_LEADS_SITE_KEY", "public-site-key");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(sendLead(payload)).rejects.toThrow("Отправка заявок временно не настроена.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends the lead only to the allowlisted endpoint with consent context", async () => {
    vi.stubEnv("NEXT_PUBLIC_LEADS_API_URL", "https://ams24.ru/api/leads");
    vi.stubEnv("NEXT_PUBLIC_LEADS_PROJECT_ID", "ams-impulse");
    vi.stubEnv("NEXT_PUBLIC_LEADS_SITE_KEY", "public-site-key-123456");
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("document", { title: "AMS IMPULSE", referrer: "" });
    vi.stubGlobal("navigator", { userAgent: "vitest" });

    await sendLead(payload);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, request] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ams24.ru/api/leads");
    const body = JSON.parse(String(request.body)) as { meta: Record<string, string> };
    expect(body.meta).toMatchObject({
      consent_accepted_at: payload.consent.acceptedAt,
      consent_scope: "lead_response",
      consent_document: "/soglasie/",
      privacy_policy: "/politika/",
    });
  });

  it("does not expose a downstream error body to the public form", async () => {
    vi.stubEnv("NEXT_PUBLIC_LEADS_API_URL", "https://ams24.ru/api/leads");
    vi.stubEnv("NEXT_PUBLIC_LEADS_PROJECT_ID", "ams-impulse");
    vi.stubEnv("NEXT_PUBLIC_LEADS_SITE_KEY", "public-site-key-123456");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "internal upstream detail" }), { status: 502 })));
    vi.stubGlobal("document", { title: "AMS IMPULSE", referrer: "" });
    vi.stubGlobal("navigator", { userAgent: "vitest" });

    await expect(sendLead(payload)).rejects.toThrow("Не удалось отправить заявку. Повторите попытку позже.");
    await expect(sendLead(payload)).rejects.not.toThrow("internal upstream detail");
  });
});
