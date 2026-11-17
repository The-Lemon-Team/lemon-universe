FROM nginx:1.27-alpine

COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/lemon-universe/browser /usr/share/nginx/html

EXPOSE 80
