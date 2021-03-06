# smart-pac
一种针对大名单过滤需求更为灵活高效的PAC构造实现。

## 介绍

尽管缺乏（或是我没有找到）对PAC（Proxy auto-config）运行环境的详细定义，但实测在某些浏览器（至少对于2017年5月的Firefox 53）中，PAC脚本是在一个可持续的环境中运行的。
这意味着现有常见的PAC脚本风格有很大的可改进空间，而更快更灵活地处理庞大的域名清单对中国大陆地区的GFW用户来说尤其重要，所以本项目希望能够在以下方面作出改进：

* 构造正则表达式加速名单过滤
* 将正则式编译结果保存在单例中供重复使用
* 方便地集成gfwlist与ip白名单
* 使用二分法检测ip白名单
* 充分利用其他潜在的可改进特性

希望这些改进对其他有大量域名需要过滤的PAC用户同样有用。

## 用法
参考对应的sample文件配置proxy.js与user.rule文件，
```
npm install
npm link
smart-pac > smart.pac
```
如要用于Windows 10下的Microsoft Edge或Internet Explorer浏览器，需要修改注册表（有可能在新版本中失效）或是Web服务器配置，以Nginx为例：
```
  location ~ \.pac$ {
    add_header Content-Type  application/x-ns-proxy-autoconfig;
  }
```
