const useFilter = createWebFilter();

useFilter({
    onCreate: function () {
        console.log('onCreate');

    },
    onOpen: function (options) {
        console.log('onOpen', options);
        options.callback = "callback_test";
    },
    onRequest: function (options) { //请求发送前
        console.log('onRequest', options);
        //return { action: "respond", response: { body: '{"value":"请求前被修改"}', status: 200, headers: { "x-test": "test" } } };
    },
    onResponse: function (options, response) {//响应返回后
        console.log('onResponse', options, response);
        //return { action: "respond", response: { body: '{"value":"响应后修改"}', status: 200, headers: { "x-test": "test" } } };
    }
});

if (false) {
    var xhr = new XMLHttpRequest();
    xhr.open('get', './demon.json');
    xhr.onload = function (options) {
        console.log('onload', options, xhr.status);
    }
    xhr.onreadystatechange = function (options) {
        console.log('onreadystatechange', options);
        if (xhr.readyState == 4 && xhr.status == 200) {

            //resolve(xhr.responseText);
            console.log("====响应 " + xhr.responseText);
            console.log("====headers " + xhr.getResponseHeader("x-test"));
        }
    }
    xhr.addEventListener("readystatechange", function (options) {
        console.log('addEventListener readystatechange', options);
    });
    xhr.send();

    console.log('xhr', xhr.hookOptions);
}
if (true) {
    fetch('./demon.json').then(function (response) {
        console.log('demo fetch response', response);
        return response.json();
    }).then(function (text) {
        console.log('demo fetch response text', text);
    });
}
if (true) {
    window.callback_test = function (data) {
        console.log("jsonp callback_test", data);
    }
    window.addEventListener('DOMContentLoaded', () => {

        let js = document.createElement("script");

        js.onerror = function () {
            alert("脚本加载失败");
            console.log("脚本加载失败", arguments);
        }
        js.src = "./jsonp.js?callback=callback_test";
        document.body.appendChild(js);
    });
}