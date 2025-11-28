import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { tap, catchError } from 'rxjs/operators';

/**
 * HTTP Interceptor для автоматической обработки аутентификации
 * 
 * Основные функции:
 * - Автоматическое добавление JWT токена к защищенным запросам
 * - Исключение публичных эндпоинтов из процесса аутентификации
 * - Детальное логирование всех HTTP запросов и ответов
 * - Обработка ошибок аутентификации (401 Unauthorized)
 * - Отладка проблем с токенами и заголовками
 * 
 * @injectable
 * 
 * Особенности работы:
 * - Перехватывает ВСЕ исходящие HTTP запросы приложения
 * - Автоматически определяет тип эндпоинта (публичный/защищенный)
 * - Добавляет Bearer токен в заголовки Authorization
 * - Обеспечивает единообразную обработку ошибок аутентификации
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService) {}

  /**
   * Основной метод перехвата HTTP запросов
   * 
   * Процесс перехвата:
   * 1. Логирование входящего запроса
   * 2. Определение типа эндпоинта (публичный/защищенный)
   * 3. Добавление токена для защищенных запросов
   * 4. Отправка модифицированного запроса
   * 5. Обработка ответов и ошибок
   * 
   * @param req - Исходный HTTP запрос
   * @param next - Обработчик для передачи модифицированного запроса
   * @returns Observable с событиями HTTP запроса
   */
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Группировка логов для лучшей читаемости в консоли
    console.group(`INTERCEPTOR: ${req.method} ${req.url}`);
    
    /**
     * Список публичных эндпоинтов, которые НЕ требуют JWT токена
     * Эти маршруты обрабатываются без добавления заголовка Authorization
     */
    const publicEndpoints = [
      '/api/auth/signin',  // Вход в систему
      '/api/auth/signup'   // Регистрация нового пользователя
    ];

    // Проверяем, является ли текущий запрос публичным
    const isPublicEndpoint = publicEndpoints.some(endpoint => 
      req.url.includes(endpoint)
    );

    console.log('Публичный эндпоинт:', isPublicEndpoint);

    /**
     * Обработка публичных эндпоинтов
     * Пропускаем запрос без изменений, так как токен не требуется
     */
    if (isPublicEndpoint) {
      console.log('Пропускаем без токена');
      console.groupEnd();
      return next.handle(req);
    }

    /**
     * Обработка защищенных эндпоинтов
     * Для этих запросов требуется JWT токен авторизации
     */
    const token = this.authService.getToken();
    console.log('Токен из AuthService:', token ? 'присутствует' : 'ОТСУТСТВУЕТ');

    /**
     * Проверка наличия токена для защищенных запросов
     * Если токен отсутствует - отправляем запрос без него (вернется 401 от сервера)
     */
    if (!token) {
      console.error('Токен отсутствует для защищенного эндпоинта:', req.url);
      console.log('Проверка localStorage:');
      console.log('   - auth-token:', localStorage.getItem('auth-token'));
      console.log('   - auth-user:', localStorage.getItem('auth-user'));
      console.groupEnd();
      return next.handle(req);
    }

    console.log('Токен найден, добавляем в заголовки');
    
    /**
     * Клонирование запроса с добавлением заголовка Authorization
     * Используется Bearer схема аутентификации
     */
    const cloned = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });

    // Детальное логирование заголовков для отладки
    console.log('Заголовки запроса после клонирования:');
    cloned.headers.keys().forEach(key => {
      console.log(`   ${key}: ${cloned.headers.get(key)}`);
    });

    console.groupEnd();
    
    /**
     * Обработка цепочки запроса с перехватом событий и ошибок
     * Используем RxJS операторы для мониторинга и обработки
     */
    return next.handle(cloned).pipe(
      /**
       * Оператор tap для побочных эффектов
       * Логирует успешные ответы и ошибки без изменения потока
       */
      tap(
        // Успешный ответ
        event => console.log(`INTERCEPTOR: Успешный ответ от ${req.url}`),
        // Ошибка (устаревший синтаксис, обычно используется catchError)
        error => console.error(`INTERCEPTOR: Ошибка от ${req.url}:`, error)
      ),
      /**
       * Оператор catchError для обработки ошибок HTTP запросов
       * Позволяет перехватывать и анализировать ошибки без прерывания потока
       */
      catchError((error: HttpErrorResponse) => {
        console.error('   INTERCEPTOR: Перехвачена ошибка:');
        console.error('   URL:', error.url);
        console.error('   Status:', error.status);
        console.error('   Status Text:', error.statusText);
        console.error('   Headers:', error.headers);
        console.error('   Error:', error.error);
        
        /**
         * Специальная обработка ошибки 401 Unauthorized
         * Это может указывать на проблемы с аутентификацией
         */
        if (error.status === 401) {
          console.error('INTERCEPTOR: Ошибка 401 - Неавторизован');
          console.error('Возможные причины:');
          console.error('   1. Токен просрочен');
          console.error('   2. Токен невалиден');
          console.error('   3. Проблема на сервере с аутентификацией');
          console.error('   4. CORS проблемы');
          
          // Дополнительная диагностика текущего состояния токена
          const currentToken = this.authService.getToken();
          console.error('   Текущий токен в интерцепторе:', currentToken ? 'присутствует' : 'отсутствует');
        }
        
        /**
         * Проброс ошибки дальше по цепочке
         * Подписчики оригинального запроса получат эту ошибку
         */
        return throwError(error);
      })
    );
  }
}