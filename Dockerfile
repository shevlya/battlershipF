# Этап 1: Сборка Angular-приложения
FROM node:18-alpine AS build-stage

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm install

# Копируем исходный код
COPY . .

# Исправляем бюджеты размера и разрешаем CommonJS зависимости
RUN npm install -D json
RUN node -e "const fs = require('fs'); const path = require('path'); const config = JSON.parse(fs.readFileSync('angular.json', 'utf8')); \
  config.projects.battleship.architect.build.configurations.production.budgets = [ \
    { type: 'initial', maximumWarning: '2mb', maximumError: '5mb' }, \
    { type: 'anyComponentStyle', maximumWarning: '10kb', maximumError: '15kb' } \
  ]; \
  config.projects.battleship.architect.build.options = config.projects.battleship.architect.build.options || {}; \
  config.projects.battleship.architect.build.options.allowedCommonJsDependencies = ['sockjs-client', 'webstomp-client']; \
  fs.writeFileSync('angular.json', JSON.stringify(config, null, 2));"

# Сборка для production
ARG API_URL=http://battleship-backend:8080
ENV API_URL=$API_URL
RUN npm run build -- --configuration production

# Этап 2: Финальный образ с Nginx
FROM nginx:alpine

# Копируем конфигурацию Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Копируем собранные файлы
COPY --from=build-stage /app/dist/battleship /usr/share/nginx/html

# Открываем порт для веб-сервера
EXPOSE 80

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]
