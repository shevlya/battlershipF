import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Проверяем, нужно ли добавлять токен к запросу
    // Пропускаем эндпоинты аутентификации
    if (req.url.includes('/api/auth/')) {
      return next.handle(req);
    }

    const token = this.authService.getToken();

    if (token) {
      const cloned = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });
      return next.handle(cloned);
    } else {
      // Можно логировать, если токен отсутствует, но запрос требует авторизации
      console.warn('No token found for request:', req.url);
    }

    return next.handle(req);
  }
}
