FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

COPY index.html /usr/share/nginx/html/
COPY script.js /usr/share/nginx/html/

# Replace nginx's default config entirely with our own
COPY nginx.conf /etc/nginx/nginx.conf

RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /tmp

USER nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]