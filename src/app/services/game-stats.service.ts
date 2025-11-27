import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Интерфейс для представления игровой статистики пользователя
 * Содержит ключевые метрики игровой активности и достижений
 */
export interface GameStats {
  /** Общее количество сыгранных игр */
  totalGames: number;
  
  /** Количество побед в играх */
  wins: number;
  
  /** Количество поражений в играх */
  losses: number;
  
  /** Количество сохраненных пользовательских расстановок кораблей */
  savedLayouts: number;
}

/**
 * Сервис для работы с игровой статистикой пользователей
 * 
 * Основные функции:
 * - Получение статистики конкретного игрока по ID
 * - Получение статистики текущего авторизованного пользователя
 * - Интеграция с бэкенд API для актуальных данных статистики
 * - Предоставление данных для отображения в профиле
 * 
 * @injectable
 * @providedIn: 'root'
 * 
 * Особенности:
 * - Типизированные интерфейсы для обеспечения целостности данных
 * - Интеграция с системой аутентификации для защищенных запросов
 * 
 *  TODO: продумать логику функционирования, пока у всех по нулям
 */
@Injectable({
  providedIn: 'root'
})
export class GameStatsService {
  /**
   * Базовый URL API для работы с игровыми данными
   * Формируется на основе environment configuration
   * 
   * Использование:
   * - Все запросы к API статистики используют этот базовый URL
   */
  private readonly API_URL = `${environment.apiUrl}/api`;

  /**
   * Конструктор сервиса
   * @param http - Angular HttpClient для выполнения HTTP запросов
   * 
   * Особенности:
   * - Внедрение зависимости HttpClient через механизм Dependency Injection
   * - Подготовка к выполнению запросов к бэкенд API
   * - Настройка для работы с защищенными эндпоинтами статистики
   */
  constructor(private http: HttpClient) {}

  /**
   * Получение игровой статистики конкретного игрока по его идентификатору
   * 
   * @param playerId - Уникальный идентификатор игрока в системе
   * @returns Observable<GameStats> - Поток с объектом игровой статистики
   * 
   * Особенности реализации:
   * - Выполняет GET запрос к эндпоинту /api/players/{playerId}/stats
   * - Возвращает Observable для асинхронной обработки
   * - Использует типизированный ответ через Generic тип GameStats
   * - Интегрируется с системой обработки ошибок HttpClient
   * 
   * Использование в компонентах:
   * ```typescript
   * // Для просмотра статистики другого игрока
   * this.gameStatsService.getPlayerStats(opponentId).subscribe({
   *   next: (stats) => {
   *     console.log('Статистика игрока:', stats);
   *     this.opponentStats = stats;
   *   },
   *   error: (error) => {
   *     console.error('Ошибка загрузки статистики:', error);
   *   }
   * });
   * ```
   */
  getPlayerStats(playerId: number): Observable<GameStats> {
    /**
     * Выполнение HTTP GET запроса к бэкенд API
     * Эндпоинт: {API_URL}/players/{playerId}/stats
     * Ожидаемый ответ: объект GameStats
     * 
     * Заголовки добавляются через HttpInterceptor
     */
    return this.http.get<GameStats>(`${this.API_URL}/players/${playerId}/stats`);
  }

  /**
   * Получение игровой статистики текущего авторизованного пользователя
   * 
   * @returns Observable<GameStats> - Поток с объектом игровой статистики текущего пользователя
   * 
   * 
   * Особенности реализации:
   * - Выполняет GET запрос к эндпоинту /api/players/current/stats
   * - Использует контекст текущей сессии для идентификации пользователя
   * - Автоматически определяет текущего пользователя через JWT токен
   * - Возвращает актуальную статистику без необходимости знать пока playerId
   * 
   * Использование в компонентах:
   * ```typescript
   * // В компоненте профиля пользователя
   * this.gameStatsService.getCurrentPlayerStats().subscribe({
   *   next: (stats) => {
   *     this.userStats = stats;
   *     this.calculateWinRate(stats);
   *   },
   *   error: (error) => {
   *     console.error('Ошибка загрузки статистики:', error);
   *     this.showErrorMessage('Не удалось загрузить статистику');
   *   }
   * });
   * ```
   * 
   * Безопасность:
   * - Требует валидный JWT токен в заголовках запроса
   * - Сервер определяет текущего пользователя на основе токена
   * - Доступно только для авторизованных пользователей
   * 
   * TODO: Пока нет нормальной работы со статистикой
   */
  getCurrentPlayerStats(): Observable<GameStats> {
    /**
     * Выполнение HTTP GET запроса к бэкенд API
     * Эндпоинт: {API_URL}/players/current/stats
     * Ожидаемый ответ: объект GameStats текущего пользователя
     * 
     * Автоматически использует JWT токен из текущей сессии
     * Заголовки авторизации добавляются через HttpInterceptor
     */
    return this.http.get<GameStats>(`${this.API_URL}/players/current/stats`);
  }
}