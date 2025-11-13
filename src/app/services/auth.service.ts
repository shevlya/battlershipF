// auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { catchError, tap } from 'rxjs/operators'; // Добавляем импорт tap

// Интерфейс для пользователя
export interface User {
  player_id: number;
  nickname: string;
  avatarUrl: string | null; // Изменяем с avatar_url на avatarUrl
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
  private readonly API_URL = 'http://localhost:8080/api/auth';
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
      avatarUrl: userData.avatarUrl || null, // Используем avatarUrl
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
    const url = `http://localhost:8080/api/players/avatar`;
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    return this.http.put(url, { avatarFileName }, { headers }).pipe(
      tap((response: any) => {
        console.log('Аватар обновлен в бэкенде:', response);
        
        // Обновляем данные пользователя
        this.updateUser({
          avatarUrl: avatarFileName // Используем avatarUrl
        });
      })
    );
  }

  // Получение данных пользователя (старый метод для совместимости)
  getUser(): any {
    return this.getCurrentUser();
  }

  changePassword(oldPassword: string, newPassword: string): Observable<any> {
    const url = `http://localhost:8080/api/auth/change-password`;
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`
    });

    const body = {
      oldPassword,
      newPassword
    };

    return this.http.post(url, body, { headers });
  }
}