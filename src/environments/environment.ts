const isBrowser = typeof window !== 'undefined';
const host = isBrowser && window.location.hostname ? window.location.hostname : 'localhost';
const port = isBrowser ? window.location.port : '';

// When served behind Nginx reverse-proxy (port 80/4210/4205), use relative /api
const useRelativeProxy = isBrowser && (port === '' || port === '80' || port === '4210' || port === '4205');

export const environment = {
  apiUrl: useRelativeProxy ? '/api' : `http://${host}:3000/api`,
};
