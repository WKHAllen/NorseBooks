import fetch from 'node-fetch';
import { Response } from './routes/util';

type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'CONNECT' | 'OPTIONS' | 'TRACE' | 'PATCH';

function logProxyError(err: Error) {
    console.log('PROXY ERROR');
    console.log('Error:', err.message);
}

export function proxy(res: Response, url: string, method: HttpMethod = 'GET', callback?: (err: any) => void) {
    const options = {
        method: method
    };

    fetch(url, options)
        .then(proxyRes => {
            proxyRes.body.pipe(res);
            if (callback) callback(null);
        })
        .catch(err => {
            logProxyError(err);
            if (callback) callback(err);
        });
}
