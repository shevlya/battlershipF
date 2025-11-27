import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/**
 * Интерфейс для представления данных пользователя в системе
 * 
 * TODO: Нужно будет разобраться потом, как будем работать со статистикой, пока здесь заглушки
 */
export interface User {
  player_id: number;          // Уникальный идентификатор игрока
  nickname: string;           // Отображаемое имя пользователя
  avatarUrl: string | null;   // URL аватара пользователя (может быть null)
  totalGames?: number;        // Общее количество сыгранных игр (опционально)
  wins?: number;              // Количество побед (опционально)
  losses?: number;            // Количество поражений (опционально)
  savedLayouts?: number;      // Количество сохраненных расстановок (опционально)
}

/**
 * Интерфейс для ответа сервера при аутентификации
 */
interface JwtResponse {
  token: string;              // JWT токен для авторизации
  type: string;               // Тип токена (обычно 'Bearer')
  player_id: number;          // ID пользователя
  nickname: string;           // Никнейм пользователя
  avatarUrl?: string;         // URL аватара
}

/**
 * Интерфейс для запроса входа в систему
 */
interface LoginRequest {
  nickname: string;           // Никнейм для входа
  password: string;           // Пароль пользователя
}

/**
 * Интерфейс для запроса регистрации нового пользователя
 */
interface SignupRequest {
  nickname: string;           // Желаемый никнейм
  password: string;           // Пароль для новой учетной записи
}

/**
 * Сервис аутентификации и управления пользователями
 * 
 * Основные функции:
 * - Регистрация и аутентификация пользователей
 * - Управление JWT токенами и их валидация
 * - Хранение и обновление данных пользователя
 * - Управление состоянием авторизации в реальном времени
 * - Интеграция с системой маршрутизации для защищенных страниц
 * 
 * @injectable
 * @providedIn: 'root'
 * 
 * Особенности безопасности:
 * - Автоматическая проверка срока действия JWT токенов
 * - Хранение в localStorage
 * - Обновления состояния авторизации
 * - Централизованная обработка ошибок аутентификации
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  /** Базовый URL API аутентификации */
  private readonly API_URL = `${environment.apiUrl}/api/auth`;
  
  /** Ключ для хранения JWT токена в localStorage */
  private readonly TOKEN_KEY = 'auth-token';
  
  /** Ключ для хранения данных пользователя в localStorage */
  private readonly USER_KEY = 'auth-user';

  /**
   * BehaviorSubject для отслеживания состояния авторизации
   * Используется для реактивных обновлений интерфейса
   */
  private authState = new BehaviorSubject<boolean>(this.hasToken());
  
  /** Публичный Observable для подписки на изменения состояния авторизации */
  public authState$ = this.authState.asObservable();

  /**
   * BehaviorSubject для данных текущего пользователя
   * Обеспечивает реактивные обновления данных пользователя
   */
  private currentUserSubject = new BehaviorSubject<User | null>(this.getStoredUser());
  
  /** Публичный Observable для подписки на изменения данных пользователя */
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  /**
   * Регистрация нового пользователя в системе
   * 
   * @param nickname - Желаемый никнейм пользователя
   * @param password - Пароль для новой учетной записи
   * @returns Observable с JWT ответом от сервера
   * 
   * После успешной регистрации требуется отдельный вызов setTokenAndUser
   */
  register(nickname: string, password: string): Observable<JwtResponse> {
    const request: SignupRequest = { nickname, password };
    return this.http.post<JwtResponse>(`${this.API_URL}/signup`, request);
  }

  /**
   * Аутентификация существующего пользователя
   * 
   * @param nickname - Никнейм пользователя
   * @param password - Пароль пользователя
   * @returns Observable с JWT ответом от сервера
   * 
   * Особенности:
   * - Сохраняет токен и данные пользователя при успешной аутентификации
   * - Использует RxJS оператор tap для побочных эффектов
   */
  login(nickname: string, password: string): Observable<JwtResponse> {
    const request: LoginRequest = { nickname, password };
    return this.http.post<JwtResponse>(`${this.API_URL}/signin`, request).pipe(
      tap(response => {
        this.setTokenAndUser(response.token, response);
      })
    );
  }

  /**
   * Выход пользователя из системы
   * 
   * Процесс выхода:
   * 1. Удаление токена и данных пользователя из localStorage
   * 2. Обновление состояния авторизации на false
   * 3. Сброс данных текущего пользователя
   * 4. Перенаправление на страницу входа
   * 
   * Вызывается при клике на "Выйти" или при истечении сессии
   */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.authState.next(false);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  /**
   * Сохранение JWT токена и данных пользователя
   * 
   * @param token - JWT токен полученный от сервера
   * @param userData - Данные пользователя из ответа сервера
   * 
   * Процесс сохранения:
   * 1. Сохранение токена в localStorage
   * 2. Преобразование данных в структуру User
   * 3. Сохранение данных пользователя в localStorage
   * 4. Обновление BehaviorSubject
   * 5. Логирование для отладки
   */
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

  /**
   * Получение JWT токена с проверкой срока действия
   * 
   * @returns string | null - Действующий токен или null если токен отсутствует или просрочен
   * 
   * Процесс проверки:
   * 1. Получение токена из localStorage
   * 2. Проверка наличия токена
   * 3. Декодирование payload токена
   * 4. Проверка срока действия (exp)
   * 5. Автоматический выход при просроченном токене
   * 
   * - Единая точка проверки токена во всем приложении
   * - Очистка просроченных токенов
   * - Логирование для отладки
   */
  getToken(): string | null {
    const token = localStorage.getItem(this.TOKEN_KEY);
    
    if (!token) {
      console.warn('🔍 AuthService: Токен не найден в localStorage');
      return null;
    }
    
    // Проверяем, не просрочен ли токен
    try {
      const payload = this.decodeToken(token);
      const exp = payload.exp * 1000; // Конвертация в миллисекунды
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

  /**
   * Декодирование JWT токена для извлечения payload
   * 
   * @param token - JWT токен для декодирования
   * @returns any - Объект с данными из payload токена
   * @throws Error - При ошибке декодирования или невалидном формате токена
   * 
   * Структура JWT: header.payload.signature
   */
  private decodeToken(token: string): any {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch (error) {
      console.error('Ошибка при декодировании токена:', error);
      throw error;
    }
  }

  /**
   * Проверка истек ли срок действия токена
   * 
   * @returns boolean - true если токен просрочен или отсутствует, false если валиден
   * 
   * Использование: Для предварительной проверки перед отправкой запросов
   */
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

  /**
   * Проверка авторизован ли пользователь в системе
   * 
   * @returns boolean - true если пользователь авторизован, false если нет
   * 
   * Использует единый метод getToken() для проверки валидности
   */
  isAuthenticated(): boolean {
    return this.hasToken();
  }

  /**
   * Внутренняя проверка наличия валидного токена
   * 
   * @returns boolean - true если токен присутствует и валиден
   */
  private hasToken(): boolean {
    return !!this.getToken(); // Используем getToken, который теперь проверяет срок действия
  }

  /**
   * Получение данных пользователя из localStorage
   * 
   * @returns User | null - Данные пользователя или null если не найдены
   */
  private getStoredUser(): User | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  /**
   * Получение данных текущего пользователя
   * 
   * @returns User | null - Текущие данные пользователя или null если не авторизован
   * 
   * Возвращает текущее значение BehaviorSubject
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Обновление данных пользователя
   * 
   * @param updatedUser - Частичный объект с обновляемыми полями пользователя
   * 
   * Процесс обновления:
   * 1. Проверка наличия текущего пользователя
   * 2. Слияние старых и новых данных
   * 3. Сохранение в localStorage
   * 4. Уведомление подписчиков об изменениях
   */
  updateUser(updatedUser: Partial<User>): void {
    const currentUser = this.currentUserSubject.value;
    if (currentUser) {
      const newUser = { ...currentUser, ...updatedUser };
      localStorage.setItem(this.USER_KEY, JSON.stringify(newUser));
      this.currentUserSubject.next(newUser);
      console.log('Пользователь обновлен в AuthService:', newUser);
    }
  }

  /**
   * Обновление аватара пользователя
   * 
   * @param avatarFileName - Имя файла нового аватара
   * @returns Observable с ответом сервера
   * 
   * Процесс обновления:
   * 1. Отправка запроса на сервер
   * 2. Автоматическое обновление данных пользователя при успехе
   * 3. Обработка ошибок с детальным логированием
   */
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

  /**
   * Получение данных пользователя (устаревший метод для совместимости)
   * 
   * @returns any - Данные пользователя
   * @deprecated Используйте getCurrentUser() для типизированного доступа
   */
  getUser(): any {
    return this.getCurrentUser();
  }

  /**
   * Смена пароля пользователя
   * 
   * @param oldPassword - Текущий пароль пользователя
   * @param newPassword - Новый пароль пользователя
   * @returns Observable с ответом сервера
   * 
   * - Требуется валидный JWT токен
   * - Логирование процесса смены пароля
   * - Обработка ошибок с детализацией
   */
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