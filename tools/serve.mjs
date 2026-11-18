// 零依赖本地服务器：node tools/serve.mjs [端口]
// 端口被占用时自动往后找一个可用端口，并在监听成功后自动打开浏览器。
// NO_OPEN=1 可关掉自动打开浏览器。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const root = process.cwd();
const startPort = Number(process.argv[2] || process.env.PORT || 8080);
const MAX_TRIES = 10;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.css': 'text/css; charset=utf-8',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
};

function handler(req, res) {
  let rel = decodeURIComponent((req.url || '/').split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const file = path.resolve(root, '.' + rel);
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 ' + rel);
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

function lanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

function openBrowser(url) {
  if (process.env.NO_OPEN) return;
  const cmd = process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;
  try {
    spawn(cmd, { shell: true, detached: true, stdio: 'ignore' }).unref();
  } catch (e) {
    /* 打不开浏览器也没关系，手动复制地址即可 */
  }
}

function listen(port, attempt) {
  const server = http.createServer(handler);
  let settled = false;

  server.once('error', (err) => {
    if (settled) return;
    settled = true;
    if (err && err.code === 'EADDRINUSE' && attempt + 1 < MAX_TRIES) {
      listen(port + 1, attempt + 1);
      return;
    }
    if (err && err.code === 'EADDRINUSE') {
      console.error('');
      console.error(`  端口 ${port} 被占用了，而且往后 ${MAX_TRIES} 个端口也都不可用。`);
      console.error('  处理办法：关掉旧的命令行窗口（可能还开着一个游戏服务器），或者换端口：');
      console.error('    node tools/serve.mjs 8090');
      console.error('');
    } else {
      console.error('');
      console.error(`  启动失败：${err && err.message ? err.message : err}`);
      console.error('');
    }
    process.exitCode = 1;
  });

  server.once('listening', () => {
    settled = true;
    const ip = lanIp();
    console.log('');
    console.log('  汉末行伍征战记 · 单机试玩版');
    console.log(`  浏览器地址： http://localhost:${port}/  （已自动尝试打开，没反应就手动复制）`);
    if (ip) console.log(`  手机试玩（同一 WiFi）： http://${ip}:${port}/`);
    console.log('  停止服务：Ctrl + C，或直接关掉这个窗口');
    console.log('');
    openBrowser(`http://localhost:${port}/`);
  });

  server.listen(port);
}

listen(startPort, 0);
