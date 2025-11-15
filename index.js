const functions = require('@google-cloud/functions-framework');
const fetch = require('node-fetch');

functions.http('proxy', async (req, res) => {
  try {
    console.log("REQUEST URL", req.originalUrl);
    const cleanedPath = req.originalUrl.replace(/^\/proxy/, '') || '/';
    const targetUrl = 'https://res200.gate1253.workers.dev' + cleanedPath;

    // 헤더 필터링
    const { host, ...forwardedHeaders } = req.headers;
    delete forwardedHeaders['content-length'];

    const headers = {
      ...forwardedHeaders,
      'User-Agent': 'CloudRunProxy/1.0',
    };

    // body 처리
    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      redirect: 'follow', // 리디렉션 따라가기
      body,
    });

    // 응답 헤더 복사
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey !== 'cache-control' && lowerKey !== 'age') {
        res.setHeader(key, value);
      }
    });

    // 바이너리 응답을 스트림으로 전달
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(response.status);
    response.body.pipe(res);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send('Proxy failed');
  }
});