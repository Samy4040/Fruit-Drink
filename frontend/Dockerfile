# Dockerfile für das Nginx Frontend
FROM nginx:alpine

# Standard Nginx-Konfig entfernen und eigene nutzen
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Frontend-Dateien kopieren
COPY *.html *.css *.js /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
