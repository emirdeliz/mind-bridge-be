import { request as httpsRequest } from 'node:https';

type HttpsJsonResponse = {
  status: number;
  body: string;
};

export const postOpenRouterJson = (
  url: string,
  headers: Record<string, string>,
  payload: unknown,
  timeoutMs: number
): Promise<HttpsJsonResponse> =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const parsed = new URL(url);
    const requestHeaders = {
      ...headers,
      'Content-Length': String(Buffer.byteLength(body)),
    };

    const req = httpsRequest(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: 'POST',
        headers: requestHeaders,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 500,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
        res.on('error', reject);
      }
    );

    const timeout = setTimeout(() => {
      req.destroy(new Error(`OpenRouter request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    req.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    req.on('close', () => {
      clearTimeout(timeout);
    });

    req.write(body);
    req.end();
  });
