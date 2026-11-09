#!/usr/bin/env node
"use strict";

const path = require("path");
const fs = require("fs");

function fail(msg) {
  console.error("ERROR: " + msg);
  process.exit(1);
}

const appid = process.env.WX_APPID;
const keyPath = process.env.WX_PRIVATE_KEY;
const version = process.env.WX_VERSION || "1.0.0";
const desc = process.env.WX_DESC || "体验版构建";

if (!appid || !/^wx[0-9a-f]{16}$/.test(appid)) {
  fail("请设置 WX_APPID 为真实小程序 AppID（形如 wx1234567890abcdef）");
}
if (!keyPath) fail("请设置 WX_PRIVATE_KEY 为代码上传密钥文件路径");
if (!fs.existsSync(keyPath)) fail("密钥文件不存在: " + keyPath);

let ci;
try {
  ci = require("miniprogram-ci");
} catch (e) {
  fail("缺少 miniprogram-ci，请先执行: npm install -g miniprogram-ci");
}

const projectRoot = path.resolve(__dirname, "..");

const project = new ci.Project({
  appid,
  type: "miniProgram",
  projectPath: projectRoot,
  privateKeyPath: path.resolve(keyPath),
  ignores: ["node_modules/**/*", "scripts/**/*", ".github/**/*"],
});

ci
  .upload({
    project,
    version,
    desc,
    setting: {
      es6: true,
      es7: true,
      minify: true,
      autoPrefixWXSS: true,
    },
    onProgressUpdate: info => {
      if (typeof info === "string") console.log(info);
      else if (info && info._msg) console.log(info._msg);
    },
  })
  .then(result => {
    console.log("上传成功");
    console.log("版本: " + version);
    if (result && result.subPackageInfo) {
      result.subPackageInfo.forEach(p => console.log("  分包 " + p.name + ": " + p.size + " 字节"));
    }
    console.log("");
    console.log("下一步（微信公众平台后台）:");
    console.log("  1. 打开 mp.weixin.qq.com -> 管理 -> 版本管理");
    console.log("  2. 在开发版本中找到本次上传，点击『选为体验版』");
    console.log("  3. 成员管理 -> 体验成员，添加使用者的微信号");
  })
  .catch(err => {
    console.error("上传失败: " + (err && err.message ? err.message : err));
    process.exit(1);
  });
