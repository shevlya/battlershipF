import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// Интерфейс для пользователя
export interface User {
  player_id: number;
  nickname: string;
  avatarUrl: string | null;
  totalGames?: number;
  wins?: number;
  losses?: number;
  savedLayouts?: number;
}

// Интерфейс для ответа от бэкенда
interface JwtResponse {
  token: string;
  type: string;
  player_id: number;
  nickname: string;
  avatarUrl?: string;
}

// Интерфейс для запроса входа
interface LoginRequest {
  nickname: string;
  password: string;
}

// Интерфейс для запроса регистрации
interface SignupRequest {
  nickname: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = `${environment.apiUrl}/api/auth`;
  private readonly TOKEN_KEY = 'auth-token';
  private readonly USER_KEY = 'auth-user';

  // Subject для отслеживания состояния авторизации
  private authState = new BehaviorSubject<boolean>(this.hasToken());
  public authState$ = this.authState.asObservable();

  // Subject для данных пользователя
  private currentUserSubject = new BehaviorSubject<User | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  // Регистрация
  register(nickname: string, password: string): Observable<JwtResponse> {
    const request: SignupRequest = { nickname, password };
    return this.http.post<JwtResponse>(`${this.API_URL}/signup`, request);
  }

  // Вход
  login(nickname: string, password: string): Observable<JwtResponse> {
    const request: LoginRequest = { nickname, password };
    return this.http.post<JwtResponse>(`${this.API_URL}/signin`, request).pipe(
      tap(response => {
        this.setTokenAndUser(response.token, response);
      })
    );
  }

  // Выход
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.authState.next(false);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  // Сохранение токена и данных пользователя
  setTokenAndUser(token: string, userData: JwtResponse): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    
    const user: User = {
      player_id: userData.player_id,
      nickname: userData.nickname,
      avatarUrl: userData.avatarUrl || null,
      totalGames: 0,
      wins: 0,
      losses: 0,
      savedLayouts: 0
    };
    
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.authState.next(true);
    this.currentUserSubject.next(user);
    console.log('Пользователь сохранен в localStorage:', user);
  }

  // Получение токена с проверкой срока действия (ЕДИНСТВЕННАЯ РЕАЛИЗАЦИЯ)
  getToken(): string | null {
    const token = localStorage.getItem(this.TOKEN_KEY);
    
    if (!token) {
      console.warn('🔍 AuthService: Токен не найден в localStorage');
      return null;
    }
    
    // Проверяем, не просрочен ли токен
    try {
      const payload = this.decodeToken(token);
      const exp = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      
      console.log('🔍 AuthService: Проверка токена:');
      console.log('  - Истекает:', new Date(exp).toLocaleString());
      console.log('  - Текущее время:', new Date(now).toLocaleString());
      console.log('  - Просрочен:', now > exp);
      
      if (now > exp) {
        console.error('❌ AuthService: Токен просрочен!');
        this.logout();
        return null;
      }
      
      console.log('✅ AuthService: Токен валиден');
      return token;
    } catch (error) {
      console.error('❌ AuthService: Ошибка декодирования токена:', error);
      return null;
    }
  }

  private decodeToken(token: string): any {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch (error) {
      console.error('Ошибка при декодировании токена:', error);
      throw error;
    }
  }

  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;
    
    try {
      const payload = this.decodeToken(token);
      return Date.now() > payload.exp * 1000;
    } catch (error) {
      return true;
    }
  }

  // Проверка, авторизован ли пользователь
  isAuthenticated(): boolean {
    return this.hasToken();
  }

  private hasToken(): boolean {
    return !!this.getToken(); // Используем getToken, который теперь проверяет срок действия
  }

  // Получение данных пользователя из localStorage
  private getStoredUser(): User | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  // Получение текущего пользователя
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  // Обновление данных пользователя
  updateUser(updatedUser: Partial<User>): void {
    const currentUser = this.currentUserSubject.value;
    if (currentUser) {
      const newUser = { ...currentUser, ...updatedUser };
      localStorage.setItem(this.USER_KEY, JSON.stringify(newUser));
      this.currentUserSubject.next(newUser);
      console.log('Пользователь обновлен в AuthService:', newUser);
    }
  }

  // Обновление аватара
  updateAvatar(avatarFileName: string): Observable<any> {
    const url = `${environment.apiUrl}/api/players/avatar`;
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.put(url, { avatarFileName }, { headers }).pipe(
      tap((response: any) => {
        console.log('Аватар обновлен в бэкенде:', response);
        
        // Обновляем данные пользователя
        this.updateUser({
          avatarUrl: avatarFileName
        });
      }),
      catchError(error => {
        console.error('Ошибка при обновлении аватара:', error);
        return throwError(error);
      })
    );
  }

  // Получение данных пользователя (старый метод для совместимости)
  getUser(): any {
    return this.getCurrentUser();
  }
  

  changePassword(oldPassword: string, newPassword: string): Observable<any> {
    const url = `${environment.apiUrl}/api/auth/change-password`;
    
    const token = this.getToken();
    console.log('🔑 Токен для запроса:', token ? 'присутствует' : 'отсутствует');

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });

    const body = {
      oldPassword,
      newPassword
    };

    console.log('🔑 Отправка запроса смены пароля:', { url, body });

    return this.http.post(url, body, { headers }).pipe(
      tap(response => console.log('✅ Пароль успешно изменен:', response)),
      catchError(error => {
        console.error('❌ Ошибка при смене пароля:', error);
        console.log('🔍 Статус ошибки:', error.status);
        console.log('🔍 Текст ошибки:', error.message);
        return throwError(error);
      })
    );
  }
}