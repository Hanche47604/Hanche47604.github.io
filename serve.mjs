import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectFolder = resolve(fileURLToPath(new URL('.', import.meta.url)));
const modelResourcePrefix = '/Resources/호시노 Live 2D/';
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8',
  '.moc3': 'application/octet-stream',
  '.wasm': 'application/wasm',
};

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method Not Allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400);
    response.end('Bad Request');
    return;
  }

  let relativePath;
  if (pathname === '/') {
    relativePath = 'Index.html';
  } else if (pathname.startsWith(modelResourcePrefix)) {
    // Live2D SDK 경로를 현재 폴더의 원본 모델 파일에 연결합니다.
    relativePath = pathname.slice(modelResourcePrefix.length);
  } else {
    relativePath = pathname.replace(/^\/+/, '');
  }

  const filePath = resolve(projectFolder, relativePath);
  if (filePath !== projectFolder && !filePath.startsWith(projectFolder + sep)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile()) {
      response.writeHead(404);
      response.end('Not Found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': fileInfo.size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });

    if (request.method === 'HEAD') {
      response.end();
      return;
    }

    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404);
    response.end('Not Found');
  }
});

function listenOnAvailablePort(port) {
  const handleError = error => {
    server.off('listening', handleListening);
    if (error.code === 'EADDRINUSE' && port < 5010) {
      listenOnAvailablePort(port + 1);
      return;
    }
    console.error(`서버를 시작하지 못했어요: ${error.message}`);
    process.exitCode = 1;
  };

  const handleListening = () => {
    server.off('error', handleError);
    const address = server.address();
    const pageUrl = `http://127.0.0.1:${address.port}/`;
    console.log(`호시노 월페이퍼 실행 중: ${pageUrl}`);
    console.log('종료하려면 이 창에서 Ctrl + C를 누르세요.');
    const browser = spawn('cmd.exe', ['/c', 'start', '', pageUrl], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    browser.unref();
  };

  server.once('error', handleError);
  server.once('listening', handleListening);
  server.listen(port, '127.0.0.1');
}

listenOnAvailablePort(5001);
