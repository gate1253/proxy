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
    // Hop-by-hop 헤더는 프록시에서 전달하면 안 됩니다.
    // 이를 전달하면 'protocol error'의 원인이 될 수 있습니다.
    delete forwardedHeaders['connection'];
    delete forwardedHeaders['keep-alive'];
    delete forwardedHeaders['proxy-authenticate'];
    delete forwardedHeaders['proxy-authorization'];
    delete forwardedHeaders['te'];
    delete forwardedHeaders['trailers'];
    delete forwardedHeaders['transfer-encoding'];
    delete forwardedHeaders['upgrade'];
    delete forwardedHeaders['content-length'];
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
      // 자동 압축 해제를 비활성화하여 Content-Encoding을 그대로 유지합니다.
      compress: false,
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
      const fallbackResponse = await fetch(fallbackUrl, { headers, compress: false });
      const fallbackBody = await fallbackResponse.buffer();

      // fallback 응답 헤더 처리
      fallbackResponse.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        // 프록시가 설정하는 헤더 외에는 모두 그대로 전달합니다.
        if (lowerKey !== 'cache-control' && lowerKey !== 'age') {
          res.setHeader(key, value);
        }
      });
      res.setHeader('Cache-Control', cacheControlHeader);
      res.setHeader('Last-Modified', new Date().toUTCString());
      res.status(fallbackResponse.status);
      res.send(fallbackBody);
    } else {
      const responseBody = await response.buffer();
      // 기존 응답 처리
      response.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        // 프록시가 설정하는 헤더 외에는 모두 그대로 전달합니다.
        if (lowerKey !== 'cache-control' && lowerKey !== 'age') {
          res.setHeader(key, value);
        }
      });
      res.setHeader('Cache-Control', cacheControlHeader);
      res.setHeader('Last-Modified', new Date().toUTCString());
      res.status(response.status);
      res.send(responseBody);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send('Proxy failed');
  }
});