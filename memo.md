主文件为```src/web-filter.js```，主文件中直接定义了```createWebFilter```函数，返回一个```useFilter```供用户注册配置。

# useFilter

调用方式为：
```javascript
let options={};
useFilter(options);
```

参数```options```定义如下：

* options.onCreate - 在请求初始化时，创建一个全局meta对象，用于数据存储。
* options.onOpen - 在请求URL和方法初始化时调用
* options.onRequest - 在请求发送前用
* options.onResponse - 在请求返回后调用

## onCreate

无参数，返回值将会包含在后续方法的meta字段中。

## onOpen

初始化URL时调用。

参数：{url,method}

```javascript
onOpen({url,method});
```

用户在注册```onOpen```时，可以修改参数。

## onRequest

请求前调用

参数：{url,method,body}

```javascript
onRequest({url,method,body});
```

## onResponse

响应成功后调用

```javascript
onResponse({url,method,body},{body,status,headers});
```

## 具体描述

在用户注册的回调函数中，只有```onRequest```和```onResponse```有响应值。

响应值格式如下：

```json
{action:"",response:{}}
```

action可选值如下：

* continue - 
* block - 阻断请求
* respond - 修改响应数据，此时必须包含```response```字段。

response结构如下：
```json
{ body: '{"value":"请求前被修改"}', status: 200, headers: { "x-test": "test" } } 
```

**body的值类型是字符串。**