const functions = require('@google-cloud/functions-framework');
const fetch = require('node-fetch');

functions.http('proxy', async (req, res) => {
  try {
    const cleanedPath = req.originalUrl.replace(/^\/proxy/, '') || '/';
    const targetUrl = 'https://res200.gate1253.workers.dev' + cleanedPath;

    const { host, ...forwardedHeaders } = req.headers;
    delete forwardedHeaders['content-length'];

    const headers = {
      ...forwardedHeaders,
      'User-Agent': 'CloudRunProxy/1.0',
    };

    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      redirect: 'follow',
      body,
    });

    // 404 또는 기타 오류 상태 처리
    if (!response.ok) {
      console.warn(`Upstream returned ${response.status} for ${targetUrl}`);
      const errorText = await response.text();
      res.status(404).send(`Not Found`);
      return;
    }

    const data = await response.text();
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    res.status(response.status).send(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send('Proxy failed');
  }
});
