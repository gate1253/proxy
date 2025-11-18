const functions = require('@google-cloud/functions-framework');
const fetch = require('node-fetch');

functions.http('proxy', async (req, res) => {
  try {
    // 쿼리스트링에서 cache 값을 읽어 max-age 설정 (기본값 60)
    const cacheParam = parseInt(req.query.cache, 10);
    const maxAge = !isNaN(cacheParam) && cacheParam >= 0 ? cacheParam : 60;
    const cacheControlHeader = `public, max-age=${maxAge}, must-revalidate`;

    console.log("REQUEST URL", req.originalUrl);
    const cleanedPath = req.originalUrl.replace(/^\/proxy/, '') || '/';
    const targetUrl = 'https://res200.gate1253.workers.dev' + cleanedPath;

    // 헤더 필터링
    const { host, ...forwardedHeaders } = req.headers;
    delete forwardedHeaders['content-length'];
    // 304 응답을 방지하기 위해 조건부 요청 헤더 제거
    delete forwardedHeaders['if-none-match'];
    delete forwardedHeaders['if-modified-since'];

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

    // 403, 404 에러 코드에 대한 대체 URL 처리
    const fallbackUrls = {
      403: req.query['403'],
      404: req.query['404'],
    };
    const fallbackUrl = fallbackUrls[response.status];

    if (fallbackUrl) {
      console.log(`Fallback for ${response.status}: fetching ${fallbackUrl}`);
      const fallbackResponse = await fetch(fallbackUrl, { headers });

      // fallback 응답 헤더 처리
      fallbackResponse.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if (lowerKey !== 'cache-control' && lowerKey !== 'age') {
          res.setHeader(key, value);
        }
      });
      res.setHeader('Cache-Control', cacheControlHeader);
      res.setHeader('Last-Modified', new Date().toUTCString());
      res.status(fallbackResponse.status);
      fallbackResponse.body.pipe(res);
    } else {
      // 기존 응답 처리
      response.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if (lowerKey !== 'cache-control' && lowerKey !== 'age') {
          res.setHeader(key, value);
        }
      });
      res.setHeader('Cache-Control', cacheControlHeader);
      res.setHeader('Last-Modified', new Date().toUTCString());
      res.status(response.status);
      response.body.pipe(res);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send('Proxy failed');
  }
});