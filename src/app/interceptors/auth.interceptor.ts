// interceptors/auth.interceptor.ts
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { tap, catchError } from 'rxjs/operators';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    console.group(`🔄 INTERCEPTOR: ${req.method} ${req.url}`);
    
    // Определяем публичные эндпоинты, которые НЕ требуют токена
    const publicEndpoints = [
      '/api/auth/signin',
      '/api/auth/signup'
    ];

    // Проверяем, является ли текущий запрос публичным
    const isPublicEndpoint = publicEndpoints.some(endpoint => 
      req.url.includes(endpoint)
    );

    console.log('Публичный эндпоинт:', isPublicEndpoint);

    // Если эндпоинт публичный - пропускаем без токена
    if (isPublicEndpoint) {
      console.log('✅ Пропускаем без токена');
      console.groupEnd();
      return next.handle(req);
    }

    // Для всех остальных запросов добавляем токен
    const token = this.authService.getToken();
    console.log('Токен из AuthService:', token ? 'присутствует' : 'ОТСУТСТВУЕТ');

    if (!token) {
      console.error('❌ Токен отсутствует для защищенного эндпоинта:', req.url);
      console.log('🔍 Проверка localStorage:');
      console.log('   - auth-token:', localStorage.getItem('auth-token'));
      console.log('   - auth-user:', localStorage.getItem('auth-user'));
      console.groupEnd();
      return next.handle(req);
    }

    console.log('✅ Токен найден, добавляем в заголовки');
    
    const cloned = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });

    console.log('📋 Заголовки запроса после клонирования:');
    cloned.headers.keys().forEach(key => {
      console.log(`   ${key}: ${cloned.headers.get(key)}`);
    });

    console.groupEnd();
    
    return next.handle(cloned).pipe(
      tap(
        event => console.log(`✅ INTERCEPTOR: Успешный ответ от ${req.url}`),
        error => console.error(`❌ INTERCEPTOR: Ошибка от ${req.url}:`, error)
      ),
      catchError((error: HttpErrorResponse) => {
        console.error('🔴 INTERCEPTOR: Перехвачена ошибка:');
        console.error('   URL:', error.url);
        console.error('   Status:', error.status);
        console.error('   Status Text:', error.statusText);
        console.error('   Headers:', error.headers);
        console.error('   Error:', error.error);
        
        if (error.status === 401) {
          console.error('🔐 INTERCEPTOR: Ошибка 401 - Неавторизован');
          console.error('Возможные причины:');
          console.error('   1. Токен просрочен');
          console.error('   2. Токен невалиден');
          console.error('   3. Проблема на сервере с аутентификацией');
          console.error('   4. CORS проблемы');
          
          // Дополнительная проверка токена
          const currentToken = this.authService.getToken();
          console.error('   Текущий токен в интерцепторе:', currentToken ? 'присутствует' : 'отсутствует');
        }
        
        return throwError(error);
      })
    );
  }
}