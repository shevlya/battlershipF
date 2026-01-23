## Версии:  
Angular CLI: 17.3.17  
Node: 20.9.0  
Package Manager: npm 10.1.0    
bootstrap подключен в main.ts    
[интерфейсы игры + инструкция пользователя](./Инструкция.pdf)     

## Команда проекта
Проект разработан командой из трёх человек:
* **[nast1x](https://github.com/nast1x)** — бэкенд-разработчик, работа с базой данных   
* **[Jane11Al](https://github.com/Jane11Al)** — бэкенд-разработчик
* **[shevlya](https://github.com/shevlya)** — дизайнер, фронтенд-разработчик, технический писатель

**Серверная часть проекта** находится в отдельном репозитории:  
https://github.com/nast1x/battleship-game-BACKEND

### Серверная часть проекта находится в отдельном репозитории:
https://github.com/nast1x/battleship-game-BACKEND

## Для запуска
`ng serve` - в терминальчике в VS code  
`http://localhost:4201/`

для игры по локальной сети в файле auth.service.ts поменяйте ip на свой (локальной сети). Запуск для игры с человеком    
`ng serve --host 0.0.0.0 --port 4201`

## Настройка окружения

### Файл environment.ts из environments

1. **Создайте локальный файл конфигурации:**
   ```bash
   # Скопируйте шаблон в рабочий файл
   cp src/environments/environment.example.ts src/environments/environment.ts

2. **Настройте параметры в src/environments/environment.ts:**
   ```typescript
   export const environment = {
    production: false,
    apiUrl: 'http://ВАШ_IP_АДРЕС:8080'  // Укажите ваш текущий IP
   };

## Для пользователей, у которых уже есть environment.ts

Если у вас уже был настроен файл `src/environments/environment.ts`, то:

1. **Ваш файл останется без изменений** при обновлении репозитория
2. **Проверьте содержимое** вашего файла - он должен содержать примерно:
   ```typescript
   export const environment = {
    production: false,
    apiUrl: 'http://ВАШ_IP_АДРЕС:8080'  // Укажите ваш текущий IP
   };

## История изменений по дням

Подробную историю изменений по дням смотрите в файле [UPDATES.md](./UPDATES.md)    
Она велась с 10 по 28 ноября. Далее изменения в программе не фиксировались в файле.
