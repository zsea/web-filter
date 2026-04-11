function createWebFilter() {
    var metaFieldName = 'hookOptions';
    var filterOptions = {};

    // 构造错误类型
    function BlockedRequestError(message) {
        // 如果没传 message，使用默认值
        if (message === undefined) {
            message = "Request was blocked by web-filter";
        }

        // 调用 Error 构造函数（等同于 super(message)）
        var error = Error.call(this, message);

        // 保持 Error 自身的特性
        if (Object.setPrototypeOf) {
            Object.setPrototypeOf(error, BlockedRequestError.prototype);
        } else {
            error.__proto__ = BlockedRequestError.prototype;
        }

        // 设置 name 和 code
        error.name = "BlockedRequestError";
        error.code = "WEB_FILTER_BLOCKED";

        return error;
    }

    // 继承 Error 的原型
    BlockedRequestError.prototype = Object.create(Error.prototype);
    // 修复 constructor 指向（你之前问过的知识点）
    BlockedRequestError.prototype.constructor = BlockedRequestError;

    // 辅助函数
    /**
 * 将 xhr.getAllResponseHeaders() 的字符串解析为原生 Headers 对象
 * @param {string} headersStr - xhr.getAllResponseHeaders() 返回的字符串
 * @returns {Headers} 解析后的 Headers 实例
 */
    function parseXhrHeadersToNative(headersStr) {
        // 创建空的 Headers 对象
        const headers = new Headers();

        // 按行分割（处理 \n 或 \r\n）
        const lines = headersStr.split(/\r?\n/);

        for (const line of lines) {
            // 跳过空行
            if (!line.trim()) continue;

            // 找到第一个冒号，分割 key 和 value
            const colonIndex = line.indexOf(':');
            if (colonIndex === -1) continue; // 格式错误的行直接跳过

            const key = line.slice(0, colonIndex).trim();
            const value = line.slice(colonIndex + 1).trim();

            // 追加到 Headers（支持多值同名头，如 Set-Cookie）
            if (key) headers.append(key, value);
        }

        return headers;
    }

    /** HOOK XHR */
    var $open = XMLHttpRequest.prototype.open;
    var $send = XMLHttpRequest.prototype.send;

    Object.defineProperty(XMLHttpRequest.prototype, metaFieldName, {
        configurable: false,
        enumerable: false,
        writable: true,
        value: undefined
    });

    var OriginalXHR = XMLHttpRequest;

    // HOOK XHR 的属性
    const fieldsMapper = {
        responseText: "body",
        responseURL: "url"
    };
    ["status", "responseText", "readyState", "statusText", "responseURL", "responseXML"].forEach(function (field) {
        var descriptor = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, field);
        var getter = descriptor && descriptor.get;
        if (getter) {
            descriptor.get = function () {
                let meta = this[metaFieldName] || {};
                let mappedField = fieldsMapper[field] || field;
                if (meta.respond && meta.respond[mappedField] !== undefined) {
                    return meta.respond[mappedField];
                }
                return getter.call(this);
            }
            Object.defineProperty(XMLHttpRequest.prototype, field, descriptor);
        }
    });

    ["getResponseHeader", "getAllResponseHeaders"].forEach(function (field) {
        var descriptor = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, field);
        var value = descriptor && descriptor.value;
        if (value) {
            descriptor.value = function () {
                let meta = this[metaFieldName] || {};
                let headers = (meta.respond || {}).headers;
                if (headers) {
                    headers = new Headers(headers);
                    if (field === "getAllResponseHeaders") {
                        let result = '';
                        headers.forEach(function (value, key) {
                            result += key + ': ' + value + '\r\n';
                        });
                        return result;
                    }
                    else if (field === "getResponseHeader") {
                        let v = headers.get(arguments[0]);
                        if (v) return v;
                    }
                }
                return value.apply(this, arguments);
            }
            Object.defineProperty(XMLHttpRequest.prototype, field, descriptor);
        }
    });
    // 开始 open
    XMLHttpRequest.prototype.open = function (method, url) {
        this[metaFieldName].method = method;
        this[metaFieldName].url = url;
        if (filterOptions.onOpen && typeof filterOptions.onOpen === 'function') {
            var options = this[metaFieldName];
            filterOptions.onOpen(options);
        }
        return $open.apply(this, [this[metaFieldName].method, this[metaFieldName].url]);
    }
    // 开始 send
    XMLHttpRequest.prototype.send = function (body) {
        //console.log('send', body);
        this[metaFieldName].body = body;
        if (filterOptions.onRequest && typeof filterOptions.onRequest === 'function') {
            var options = this[metaFieldName];
            var response = filterOptions.onRequest(options);
            if (response) {
                if (response.action === "block") {
                    // 触发onerror事件
                    var error = new BlockedRequestError();
                    var event = new Event('error');
                    event.error = error;
                    this.dispatchEvent(event);
                    return;
                }
                else if (response.action === "respond") {
                    var respond = response.response || {};
                    respond.status = respond.status || 200;
                    respond.body = respond.body || '';
                    respond.statusText = respond.statusText || 'OK';
                    respond.readyState = respond.readyState || 4;
                    this[metaFieldName].respond = respond; // 存储响应数据
                    this.dispatchEvent(new Event('readystatechange'));
                    this.dispatchEvent(new ProgressEvent('load'));

                    return
                }
            }

        }
        return $send.apply(this, [this[metaFieldName].body]);
    }
    // 开始 constructor
    window.XMLHttpRequest = function XMLHttpRequest() {
        var xhr = new OriginalXHR();
        xhr.addEventListener("readystatechange", function (event) {
            if (filterOptions.onResponse && typeof filterOptions.onResponse === 'function') {
                // 当 readyState == 4 时，表示请求已完成
                if (this.readyState === 4) {
                    var options = this[metaFieldName];
                    //console.log('XHR onResponse options', this.getAllResponseHeaders());
                    var headers = parseXhrHeadersToNative(this.getAllResponseHeaders());
                    var response = filterOptions.onResponse(options, {
                        status: this.status,
                        text: this.responseText,
                        headers: headers
                    });
                    if (response) {
                        if (response.action === "block") {
                            var error = new BlockedRequestError();
                            var event = new Event('error');
                            event.error = error;
                            this.dispatchEvent(event);
                            event.stopImmediatePropagation(); // 阻止后续事件处理程序执行
                            return;
                        }
                        else if (response.action === "respond") {
                            var respond = response.response || {};
                            respond.status = respond.status || 200;
                            respond.body = respond.body || '';
                            respond.statusText = respond.statusText || 'OK';
                            respond.readyState = respond.readyState || 4;
                            respond.headers = respond.headers;
                            this[metaFieldName].respond = respond; // 存储响应数据
                            return
                        }
                    }
                }
            }
        });
        var hookOptions = {};
        xhr[metaFieldName] = hookOptions;
        if (filterOptions.onCreate && typeof filterOptions.onCreate === 'function') {
            var meta = filterOptions.onCreate();
            xhr[metaFieldName].meta = meta;
        }
        return xhr;
    };
    window.XMLHttpRequest.prototype = OriginalXHR.prototype;
    window.XMLHttpRequest.prototype.constructor = window.XMLHttpRequest;
    /** 结束 XHR */

    /** 开始 fetch */

    ["url", "type"].forEach(function (field) {
        var descriptor = Object.getOwnPropertyDescriptor(Response.prototype, field);
        var getter = descriptor && descriptor.get;
        if (getter) {
            descriptor.get = function () {
                console.log('Response get', field);
                let meta = this[metaFieldName] || {};
                if (meta.respond && meta.respond[field] !== undefined) {
                    return meta.respond[field];
                }
                return getter.call(this);
            }
            Object.defineProperty(Response.prototype, field, descriptor);
        }
    });
    var $fetch = window.fetch;
    window.fetch = function (input, init) {
        var url = typeof input === 'string' ? input : input.url;
        var init = init || {};
        var method = (init && init.method) || 'GET';
        var body = init && init.body;

        var hookOptions = { url, method, body };
        if (filterOptions.onCreate && typeof filterOptions.onCreate === 'function') {
            var meta = filterOptions.onCreate();
            hookOptions.meta = meta;
        }

        var options = hookOptions;
        hookOptions.url = options.url;
        hookOptions.type = 'basic';
        hookOptions.method = options.method;
        if (filterOptions.onOpen && typeof filterOptions.onOpen === 'function') {
            filterOptions.onOpen(options);
            init.method = options.method;
            init.body = options.body;
        }
        if (filterOptions.onRequest && typeof filterOptions.onRequest === 'function') {
            var response = filterOptions.onRequest(options) || { action: "continue" };
            if (response) {
                if (response.action === "block") {
                    return Promise.reject(new BlockedRequestError());
                }
                else if (response.action === "respond") {
                    var respond = response.response || {};
                    respond.status = respond.status || 200;
                    respond.body = respond.body || '';
                    respond.statusText = respond.statusText || 'OK';
                    respond.url = respond.url || options.url;
                    respond.type = respond.type || 'basic';
                    var headers = new Headers(respond.headers || {});
                    hookOptions.respond = respond; // 存储响应数据

                    let res = new Response(respond.body, {
                        status: respond.status,
                        statusText: respond.statusText,
                        headers: headers
                    });
                    res[metaFieldName] = hookOptions;
                    //res.type = 'basic';
                    return Promise.resolve(res);
                }
            }
        }
        return $fetch.apply(this, [options.url, init]).then(function (response) {
            console.log('fetch response', response);
            if (filterOptions.onResponse && typeof filterOptions.onResponse === 'function') {
                var options = hookOptions;
                var status = response.status;

                return response.text().then(function (text) {
                    var res = filterOptions.onResponse(options, { status: status, text: text, headers: response.headers }) || { action: "continue" };
                    if (res.action === "block") {
                        return Promise.reject(new BlockedRequestError());
                    }
                    else if (res.action === "respond" || res.action === "continue") {
                        var respond = res.response || {};
                        respond.status = respond.status || response.status || 200;
                        respond.body = respond.body || text || '';
                        respond.statusText = respond.statusText || response.statusText || 'OK';
                        respond.url = respond.url || response.url || options.url;
                        respond.type = respond.type || response.type || 'basic';
                        var headers = new Headers(respond.headers || response.headers);
                        hookOptions.respond = respond; // 存储响应数据
                        let resp = new Response(respond.body, {
                            status: respond.status,
                            statusText: respond.statusText,
                            headers: headers
                        });
                        resp[metaFieldName] = hookOptions;
                        return Promise.resolve(resp);
                    }
                    return Promise.reject(new Error('Invalid action from filter response'));
                })

            }
            return response;
        });
    }


    // 开始 JSONP
    var jsonpCallbackCounter = 0;
    var $createElement = document.createElement;
    document.createElement = function createElement(tagName) {
        var element = $createElement.call(this, tagName);
        //console.log('createElement', tagName, element.tagName);
        if (element.tagName.toLocaleUpperCase() === "SCRIPT") {
            var hookOptions = { method: "script" };
            if (filterOptions.onCreate && typeof filterOptions.onCreate === 'function') {
                var meta = filterOptions.onCreate();
                hookOptions.meta = meta;
            }
            element[metaFieldName] = hookOptions;
        }
        return element;
    }
    function scriptOnOpen(options) {
        let self = this;
        if (filterOptions.onOpen && typeof filterOptions.onOpen === 'function') {
            filterOptions.onOpen(options);
        }
        if (filterOptions.onRequest && typeof filterOptions.onRequest === 'function') {
            var response = filterOptions.onRequest(options) || { action: "continue" };
            if (response) {
                if (response.action === "block") {
                    // 阻止脚本加载
                    let name = "blocked_jsonp_callback_" + (jsonpCallbackCounter++);
                    window[name] = function () {
                        var error = new BlockedRequestError();
                        var event = new Event('error');
                        event.error = error;
                        self.dispatchEvent(event); // 触发 onerror 事件
                        delete window[name]; // 清理全局函数
                        URL.revokeObjectURL(options.url); // 释放 Blob URL
                    };
                    var body = `${name}();`;
                    var blob = new Blob([body], { type: 'text/javascript' });
                    options.url = URL.createObjectURL(blob);
                    return;
                }
                else if (response.action === "respond") {
                    var respond = response.response || {};
                    var cb = options.callback;
                    var body = respond.body;
                    if (cb) {
                        body = `${cb}(${body});`;
                    }
                    if (body) {
                        var blob = new Blob([body], { type: 'text/javascript' });
                        //setter.apply(this, [URL.createObjectURL(blob)]);
                        options.url = URL.createObjectURL(blob);
                        this.addEventListener('load', function () {
                            URL.revokeObjectURL(options.url);
                        });
                    }

                }
            }
        }
        if (filterOptions.onResponse && typeof filterOptions.onResponse === 'function') {
            var cb = options.callback;
            if (cb) {
                var originalCallback = window[cb];
                window[cb] = function () {
                    var obj = arguments[0];
                    var response = filterOptions.onResponse(options, { text: JSON.stringify(obj) }) || { action: "continue" };
                    if (response.action === "block") {
                        // 阻止脚本执行
                        var error = new BlockedRequestError();
                        var event = new Event('error');
                        event.error = error;
                        self.dispatchEvent(event);
                        return;
                    }
                    else if (response.action === "respond") {
                        var respond = response.response || {};
                        var body = respond.body || '';
                        body = JSON.parse(body);
                        originalCallback.apply(this, [body]);
                        return;
                    }
                    originalCallback.apply(this, arguments);
                };
            }

        }
    }
    //var srcSetter = undefined;
    (function () {
        var descriptor = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, "src");
        var setter = descriptor["set"];
        //srcSetter = setter;
        descriptor["set"] = function (value) {
            let meta = this[metaFieldName] || {};
            meta.url = value;
            scriptOnOpen.apply(this, [meta]);
            return setter.apply(this, [meta.url]);
        }
        Object.defineProperty(HTMLScriptElement.prototype, "src", descriptor);

    })();
    (function () {
        var $setAttribute = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function () {
            if (this.tagName == "SCRIPT" && arguments[0].toLocaleLowerCase() == "src") {
                let meta = this[metaFieldName] || {};
                meta.url = arguments[1];
                scriptOnOpen.apply(this, [meta]);
            }
            return $setAttribute.apply(this, [arguments[0], meta.url]);
        }
    })();

    /**
     * @param {Object} options
     * 
     */
    return function useFilter(options) {
        filterOptions = options || {};
    }
}

