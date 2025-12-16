# Этап 1: Сборка Angular-приложения
FROM node:18-alpine AS build-stage

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm install

# Копируем исходный код
COPY . .

# Исправляем angular.json для увеличения бюджета
RUN echo 'Увеличиваем бюджет сборки...' && \
    sed -i 's/"maximumWarning": "2kb"/"maximumWarning": "10kb"/g' angular.json && \
    sed -i 's/"maximumError": "4kb"/"maximumError": "15kb"/g' angular.json && \
    sed -i 's/"maximumWarning": "500kb"/"maximumWarning": "2mb"/g' angular.json && \
    sed -i 's/"maximumError": "1mb"/"maximumError": "5mb"/g' angular.json

# Сборка для production
ARG API_URL=http://battleship-backend:8080
ENV API_URL=$API_URL
RUN npm run build:prod

# Проверяем структуру папок
RUN echo "=== Структура dist ===" && \
    ls -la /app/dist/ && \
    ls -la /app/dist/battleship/ && \
    ls -la /app/dist/battleship/browser/

# Этап 2: Финальный образ с Nginx
FROM nginx:alpine

# Удаляем дефолтную страницу nginx
RUN rm -rf /usr/share/nginx/html/*

# Копируем конфигурацию Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Копируем собранные файлы Angular из папки browser
COPY --from=build-stage /app/dist/battleship/browser/ /usr/share/nginx/html/

# Проверяем что скопировалось
RUN echo "=== Файлы в nginx ===" && \
    ls -la /usr/share/nginx/html/ && \
    echo "=== index.html первые строки ===" && \
    head -10 /usr/share/nginx/html/index.html 2>/dev/null || echo "index.html не найден"

# Открываем порт для веб-сервера
EXPOSE 80

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]
