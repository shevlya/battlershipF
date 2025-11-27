import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Интерфейс для представления данных игрока в системе
 * Используется для отображения информации о пользователях в мультиплеере
 */
export interface Player {
  /** Уникальный идентификатор игрока в системе */
  playerId: number;
  
  /** Отображаемое имя игрока */
  nickname: string;
  
  /** URL аватара игрока или null если аватар не установлен */
  avatarUrl: string | null;
}

/**
 * Сервис для работы с данными игроков в системе
 * 
 * Основные функции:
 * - Получение списка всех зарегистрированных игроков
 * - Управление данными пользователей для мультиплеерных функций
 * - Интеграция с бэкенд API для получения актуальной информации об игроках
 * 
 * @injectable
 * @providedIn: 'root'
 * 
 * Особенности:
 * - Централизованное управление данными игроков во всем приложении
 * - Интеграция с системой мультиплеера для выбора противников
 * - Использование RxJS Observable
 */
@Injectable({
  providedIn: 'root'
})
export class PlayerService {
  /**
   * Базовый URL API для работы с данными игроков
   * Формируется на основе environment configuration
   * 
   * Использование:
   * - Все запросы к API игроков используют этот базовый URL
   */
  private readonly API_URL = `${environment.apiUrl}/api/players`;

  /**
   * Конструктор сервиса
   * @param http - Angular HttpClient для выполнения HTTP запросов
   * 
   * Особенности:
   * - Внедрение зависимости HttpClient через механизм Dependency Injection
   * - Подготовка к выполнению запросов к бэкенд API
   * - Настройка для будущего добавления заголовков авторизации
   */
  constructor(private http: HttpClient) {}

  /**
   * Получение списка всех зарегистрированных игроков в системе
   * 
   * @returns Observable<Player[]> - Поток с массивом объектов Player
   * 
   * Особенности реализации:
   * - Выполняет GET запрос к эндпоинту /api/players/all
   * - Возвращает Observable для асинхронной обработки
   * - Использует типизированный ответ через Generic тип Player[]
   * - Интегрируется с системой обработки ошибок HttpClient
   * 
   * Использование в компонентах:
   * ```typescript
   * this.playerService.getAllPlayers().subscribe({
   *   next: (players) => {
   *     this.players = players;
   *     console.log('Загружены игроки из БД:', players);
   *   },
   *   error: (err) => {
   *     console.error('Ошибка при загрузке игроков:', err);
   *     this.error = 'Не удалось загрузить список игроков';
   *   }
   * });
   * ```
   */

  getAllPlayers(): Observable<Player[]> {
    /**
     * Выполнение HTTP GET запроса к бэкенд API
     * Эндпоинт: {API_URL}/all
     * Ожидаемый ответ: массив объектов Player
     */
    return this.http.get<Player[]>(`${this.API_URL}/all`);
  }
}