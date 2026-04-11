# web-filter

A lightweight browser request interceptor for Fetch, XMLHttpRequest, and JSONP (`script src`) channels.

> This document follows the current implementation in [src/web-filter.js](src/web-filter.js).

## Navigation

- [Features](#features)
- [Quick Start](#quick-start)
- [Lifecycle Hooks](#lifecycle-hooks)
- [Action Contract](#action-contract)
- [Demo Mapping](#demo-mapping)
- [Build and Test](#build-and-test)
- [Notes](#notes)
- [License](#license)
- [References](#references)

## Features

- Intercepts Fetch, XHR, and JSONP with a unified API.
- Provides four hooks: `onCreate`, `onOpen`, `onRequest`, `onResponse`.
- Supports `continue`, `block`, and `respond` actions.
- Allows request/response mutation before and after network execution.
- Carries `meta` data from `onCreate` through the whole request lifecycle.

## Quick Start

### 1. Include script

```html
<script src="./src/web-filter.js"></script>
```

### 2. Register filter

```javascript
const useFilter = createWebFilter();

useFilter({
  onCreate() {
    return { traceId: Date.now() };
  },
  onOpen(options) {
    // options: { url, method, meta, ... }
  },
  onRequest(options) {
    if (String(options.url).includes("/mock")) {
      return {
        action: "respond",
        response: {
          body: JSON.stringify({ ok: true, source: "request" }),
          status: 200,
          headers: { "x-mock": "request" }
        }
      };
    }
    return { action: "continue" };
  },
  onResponse(options, response) {
    return {
      action: "respond",
      response: {
        body: response.text,
        status: response.status,
        headers: { "x-mock": "response" }
      }
    };
  }
});
```

## Lifecycle Hooks

Based on [memo.md](memo.md) and [src/web-filter.js](src/web-filter.js):

- `onCreate()`
Returns an object that will be stored in `meta` and reused in later hooks.

- `onOpen(options)`
Triggered after URL/method initialization. You can mutate `options` directly.

- `onRequest(options)`
Triggered before request dispatch. Return an action object to control flow.

- `onResponse(options, response)`
Triggered after response is available. You can continue, block, or replace response. The `response` object includes the following fields:

  * headers
  * status
  * text
  * url

## Action Contract

`onRequest` and `onResponse` should return:

```json
{ "action": "continue|block|respond", "response": {} }
```

- `continue`
Pass through original flow.

- `block`
Abort request.
  - Fetch: rejects with `BlockedRequestError`
  - XHR/JSONP: triggers error behavior

- `respond`
Use your synthetic response as final result.

Suggested `response` payload:

```json
{
  "body": "{\"value\":\"mocked\"}",
  "status": 200,
  "statusText": "OK",
  "headers": { "x-test": "test" }
}
```

Notes:
- `body` should be a string (especially for XHR/Fetch compatibility).
- Defaults are applied internally if fields are missing.

## Demo Mapping

- Demo page: [demo/demo.html](demo/demo.html)
- Hook usage sample: [demo/demo.js](demo/demo.js)
- XHR/Fetch test payload: [demo/demon.json](demo/demon.json)
- JSONP script sample: [demo/jsonp.js](demo/jsonp.js)

## Build and Test

### Install

```bash
npm install
```

### Build

```bash
npm run build
```

Build output:

- Input: [src/web-filter.js](src/web-filter.js)
- Output: [dist/web-filter.js](dist/web-filter.js)
- The output file is minified into one line for distribution.

### Test

```bash
npm test
```

## Notes

- This library intercepts by patching global browser APIs (`XMLHttpRequest`, `fetch`, and `HTMLScriptElement.src`), so initialize it early.
- For JSONP, callback handling must match your query parameter and hook logic.
- Tests in this repository include legacy naming differences; docs follow current source behavior.
- This project is for learning and testing purposes only. Do not use it for illegal activities.

## License

MIT

## References

* [你以为你请求的就是你想请求的吗？](https://www.lsz.sc.cn/posts/page/2/)
