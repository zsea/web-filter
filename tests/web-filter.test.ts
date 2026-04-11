import { describe, expect, it, vi } from "vitest";
import { BlockedRequestError, createWeFilter } from "../src/web-filter.js";

describe("web-filter", () => {
  it("passes requestMeta from onInit into onRequest and onResponse", async () => {
    const originalFetch = globalThis.fetch;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    );

    const filter = createWeFilter();
    let seenInRequest: unknown;
    let seenInResponse: unknown;

    filter.onInit(() => ({ source: "button-click" }));
    filter.onRequest((ctx) => {
      seenInRequest = ctx.requestMeta;
      return;
    });
    filter.onResponse((ctx) => {
      seenInResponse = ctx.requestMeta;
      return ctx.response;
    });

    filter.enable();
    await fetch("/meta");

    expect(seenInRequest).toEqual({ source: "button-click" });
    expect(seenInResponse).toEqual({ source: "button-click" });

    filter.restore();
    vi.stubGlobal("fetch", originalFetch);
  });

  it("throws BlockedRequestError when beforeRequest blocks fetch", async () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));

    const filter = createWeFilter();
    filter.onRequest(() => ({ action: "block", reason: "not allowed" }));
    filter.enable();

    await expect(fetch("/blocked")).rejects.toBeInstanceOf(BlockedRequestError);

    filter.restore();
    vi.stubGlobal("fetch", originalFetch);
  });

  it("returns synthetic response for fetch", async () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchSpy);

    const filter = createWeFilter();
    filter.onRequest(() => ({
      action: "respond",
      response: {
        status: 200,
        data: { mocked: true }
      }
    }));
    filter.enable();

    const response = await fetch("/mock");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ mocked: true });
    expect(fetchSpy).not.toHaveBeenCalled();

    filter.restore();
    vi.stubGlobal("fetch", originalFetch);
  });

  it("supports JSONP synthetic response", async () => {
    const filter = createWeFilter();
    const received: unknown[] = [];

    (window as Window & Record<string, unknown>).myJsonpCallback = (data: unknown) => {
      received.push(data);
    };

    filter.onRequest((ctx) => {
      if (ctx.channel === "jsonp") {
        return {
          action: "respond",
          response: {
            data: { hello: "jsonp" }
          }
        };
      }
      return;
    });

    filter.enable();

    const script = document.createElement("script");
    script.src = "https://example.com/jsonp?callback=myJsonpCallback";
    document.body.appendChild(script);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(received).toEqual([{ hello: "jsonp" }]);

    filter.restore();
    delete (window as Window & Record<string, unknown>).myJsonpCallback;
  });

  it("supports XHR synthetic response with compatible lifecycle", async () => {
    const filter = createWeFilter();
    const events: string[] = [];
    let seenMetaInResponse: unknown;

    filter.onInit((ctx) => {
      if (ctx.channel === "xhr") {
        return "xhr-trace";
      }
      return undefined;
    });

    filter.onRequest((ctx) => {
      if (ctx.channel === "xhr") {
        return {
          action: "respond",
          response: {
            status: 202,
            statusText: "Accepted",
            data: { mocked: "xhr" }
          }
        };
      }
      return;
    });

    filter.onResponse((ctx) => {
      if (ctx.channel === "xhr") {
        seenMetaInResponse = ctx.requestMeta;
      }
      return ctx.response;
    });

    filter.enable();

    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = () => {
      events.push(`ready:${xhr.readyState}`);
    };
    xhr.onload = () => {
      events.push("load");
    };
    xhr.addEventListener("loadend", () => {
      events.push("loadend");
    });

    xhr.open("GET", "/xhr-mock");
    xhr.send();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(xhr.readyState).toBe(4);
    expect(xhr.status).toBe(202);
    expect(xhr.statusText).toBe("Accepted");
    expect(xhr.responseText).toBe('{"mocked":"xhr"}');
    expect(events).toContain("ready:4");
    expect(events).toContain("load");
    expect(events).toContain("loadend");
    expect(seenMetaInResponse).toBe("xhr-trace");

    filter.restore();
  });

  it("throws BlockedRequestError for JSONP blocking", () => {
    const filter = createWeFilter();

    filter.onRequest((ctx) => {
      if (ctx.channel === "jsonp") {
        return { action: "block", reason: "jsonp blocked" };
      }
      return;
    });

    filter.enable();

    const script = document.createElement("script");
    script.src = "https://example.com/jsonp?callback=cb1";

    expect(() => document.body.appendChild(script)).toThrow(BlockedRequestError);

    filter.restore();
  });
});
