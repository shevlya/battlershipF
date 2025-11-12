import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

// Интерфейс для ответа от бэкенда
interface JwtResponse {
  token: string;
  type: string;
  id: number;
  nickname: string;
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
  private readonly API_URL = 'http://localhost:8080/api/auth'; // Убедитесь, что URL правильный
  private readonly TOKEN_KEY = 'auth-token';
  private readonly USER_KEY = 'auth-user';

  // Subject для отслеживания состояния авторизации
  private authState = new BehaviorSubject<boolean>(this.hasToken());
  public authState$ = this.authState.asObservable();

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
    return this.http.post<JwtResponse>(`${this.API_URL}/signin`, request);
  }

  // Выход
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.authState.next(false);
    this.router.navigate(['/login']);
  }

  // Сохранение токена и данных пользователя
  setTokenAndUser(token: string, userData: JwtResponse): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify({
      id: userData.id,
      nickname: userData.nickname
    }));
    this.authState.next(true);
  }

  // Получение токена
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  // Проверка, авторизован ли пользователь
  isAuthenticated(): boolean {
    return this.hasToken();
  }

  private hasToken(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }

  // Получение данных пользователя
  getUser(): any {
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }
}
