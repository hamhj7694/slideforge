import { expect, test } from "@playwright/test";
import { getSettings, type SettingsView } from "./helpers/api";

test.describe("J. Security and validation", () => {
  test("rejects SSRF URLs on /api/import-url", async ({ request }) => {
    const blocked = [
      "http://localhost:3070",
      "http://127.0.0.1:3070",
      "http://169.254.169.254/latest/meta-data",
      "file:///etc/passwd",
    ];
    for (const url of blocked) {
      const response = await request.post("/api/import-url", { data: { url } });
      expect(response.status(), `${url} must be rejected`).toBe(400);
      const body = (await response.json()) as { ok: boolean; error?: string };
      expect(body.ok).toBe(false);
      expect(body.error).toBeTruthy();
    }
  });

  test("rejects disallowed, mismatched and oversized uploads", async ({ request }) => {
    test.setTimeout(60_000);

    const disallowed = await request.post("/api/uploads", {
      multipart: {
        file: {
          name: "payload.exe",
          mimeType: "application/octet-stream",
          buffer: Buffer.from("MZ fake executable"),
        },
      },
    });
    expect(disallowed.status()).toBe(400);
    expect(((await disallowed.json()) as { ok: boolean }).ok).toBe(false);

    const mimeMismatch = await request.post("/api/uploads", {
      multipart: {
        file: {
          name: "resume.txt",
          mimeType: "application/pdf",
          buffer: Buffer.from("not actually a pdf"),
        },
      },
    });
    expect(mimeMismatch.status()).toBe(400);

    const oversized = await request.post("/api/uploads", {
      multipart: {
        file: {
          name: "huge.txt",
          mimeType: "text/plain",
          buffer: Buffer.alloc(21 * 1024 * 1024, 0x41),
        },
      },
    });
    expect(oversized.status()).toBe(400);
    expect(((await oversized.json()) as { ok: boolean }).ok).toBe(false);
  });

  test("settings GET exposes only hasKey/maskedKey and never the raw key", async ({ request }) => {
    const original = (await getSettings(request)).settings;
    // Never overwrite the key of the provider that is actually in use.
    const fakeProvider = original.provider === "openai" ? "openrouter" : "openai";
    const fakeKey = "qa-fake-key-ABCDEF123456";

    try {
      await request.patch("/api/settings", {
        data: { provider: fakeProvider, apiKey: fakeKey },
      });

      const response = await request.get("/api/settings");
      const raw = await response.text();
      const body = JSON.parse(raw) as { settings: SettingsView };
      expect(body.settings.hasKey).toBe(true);
      expect(typeof body.settings.maskedKey).toBe("string");
      expect(body.settings.maskedKey).toContain("···");
      expect(body.settings.maskedKey).not.toContain(fakeKey);
      expect(body.settings).not.toHaveProperty("apiKey");
      expect(raw).not.toContain(fakeKey);
    } finally {
      await request.patch("/api/settings", {
        data: { provider: fakeProvider, clearApiKey: true },
      });
      await request.patch("/api/settings", {
        data: {
          provider: original.provider,
          model: original.model,
          baseUrl: original.baseUrl,
        },
      });
    }
  });
});
