import fetch from 'node-fetch';
import { Response } from './routes/util';

type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'CONNECT' | 'OPTIONS' | 'TRACE' | 'PATCH';

function logProxyError(err: Error) {
    console.log('PROXY ERROR');
    console.log('Error:', err.message);
}

export function proxy(res: Response, url: string, method: HttpMethod = 'GET', callback?: () => void) {
    const options = {
        method: method
    };

    fetch(url, options)
        .then(proxyRes => {
            proxyRes.body.pipe(res);
            if (callback) callback();
        })
        .catch(err => logProxyError(err));
}
