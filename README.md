# web-filter

轻量浏览器请求拦截器：统一拦截并处理 Fetch、XMLHttpRequest 与 JSONP（script src）请求。

> 当前文档以 [src/web-filter.js](src/web-filter.js) 的实现为准。

## 导航

- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [生命周期与回调](#生命周期与回调)
- [Action 协议](#action-协议)
- [Demo 对照](#demo-对照)
- [构建与测试](#构建与测试)
- [注意事项](#注意事项)
- [许可证](#许可证)

## 功能特性

- 同时支持 Fetch、XHR、JSONP 三种常见请求通道。
- 提供统一生命周期回调：`onCreate`、`onOpen`、`onRequest`、`onResponse`。
- 支持三种控制动作：`continue`、`block`、`respond`。
- 可在请求前、响应后修改 URL、方法、请求体、响应体与状态码。
- `onCreate` 生成的 `meta` 可贯穿完整请求链路。

## 快速开始

### 1. 引入脚本

```html
<script src="./src/web-filter.js"></script>
```

### 2. 注册过滤器

```javascript
const useFilter = createWebFilter();

useFilter({
  onCreate() {
    return { traceId: Date.now() };
  },
  onOpen(options) {
    // options: { url, method, meta, ... }
    // 可在这里改写 url / method
  },
  onRequest(options) {
    // 例如：按 URL 返回 mock
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
    // response: { status, text, headers }
    // 例如：统一改写返回文本
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

## 生命周期与回调

来自 [memo.md](memo.md) 与 [src/web-filter.js](src/web-filter.js) 的约定如下：

- `onCreate()`
返回值会写入当前请求上下文的 `meta` 字段。

- `onOpen(options)`
在 URL/方法初始化后触发，`options` 可被直接修改。

- `onRequest(options)`
请求发出前触发，可返回动作控制结果。

- `onResponse(options, response)`
收到响应后触发，可继续放行、阻断或改写响应。

## Action 协议

`onRequest` 与 `onResponse` 的返回结构：

```json
{ "action": "continue|block|respond", "response": {} }
```

- `continue`
继续原始流程。

- `block`
阻断请求。
  - Fetch：`Promise.reject(BlockedRequestError)`
  - XHR/JSONP：触发 `error` 行为

- `respond`
使用你提供的响应数据替代真实响应。

推荐的 `response` 字段：

```json
{
  "body": "{\"value\":\"mocked\"}",
  "status": 200,
  "statusText": "OK",
  "headers": { "x-test": "test" }
}
```

说明：
- `body` 应为字符串（尤其在 XHR/Fetch 场景）。
- 未提供时内部会补默认值（如 `status=200`、`statusText=OK`）。

## Demo 对照

可直接查看 demo 文件：

- 页面入口：[demo/demo.html](demo/demo.html)
- 过滤器示例：[demo/demo.js](demo/demo.js)
- XHR/Fetch 测试数据：[demo/demon.json](demo/demon.json)
- JSONP 测试脚本：[demo/jsonp.js](demo/jsonp.js)

## 构建与测试

### 安装依赖

```bash
npm install
```

### 运行构建

```bash
npm run build
```

构建结果：

- 输入：[src/web-filter.js](src/web-filter.js)
- 输出：[dist/web-filter.js](dist/web-filter.js)
- 产物为单行压缩文件，适合发布或生产环境引用。

### 运行测试

```bash
npm test
```

## 注意事项

- 该库通过重写全局对象实现拦截（`XMLHttpRequest`、`fetch`、`HTMLScriptElement.src`），建议尽早初始化。
- JSONP 场景需要正确识别 callback 参数，demo 中在 `onOpen` 设置了 `options.callback`。
- 当前仓库测试文件与源码 API 命名存在历史差异，文档以源码实现为准。
- 该项目仅用于学习测试，请勿用于非法用途。

## 许可证

MIT
