import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Сервис для работы с аватарами пользователей
 * 
 * Основные функции:
 * - Получение списка доступных аватаров с сервера
 * - Управление коллекцией изображений для пользовательских профилей
 * - Интеграция с системой выбора и обновления аватаров
 * 
 * @injectable
 * @providedIn: 'root'
 * 
 * Особенности:
 * - Централизованное управление аватарами во всем приложении
 * - Интеграция с бэкенд API для получения актуального списка
 * - Использование HttpClient для HTTP запросов
 */
@Injectable({
  providedIn: 'root'
})
export class AvatarService {
  /**
   * Базовый URL API для работы с данными игроков
   * Формируется на основе environment configuration
   */
  private readonly API_URL = `${environment.apiUrl}/api/players`;

  /**
   * Конструктор сервиса
   * @param http - Angular HttpClient для выполнения HTTP запросов
   * 
   * Использование:
   * - Внедрение зависимости HttpClient через механизм Dependency Injection
   * - Подготовка к выполнению запросов к бэкенд API
   */
  constructor(private http: HttpClient) {}

  /**
   * Получение списка доступных аватаров с сервера
   * 
   * @returns Observable<string[]> - Поток с массивом имен файлов аватаров
   * 
   * Особенности реализации:
   * - Выполняет GET запрос к эндпоинту /api/players/avatars
   * - Возвращает Observable для асинхронной обработки
   * - Интегрируется с системой обработки ошибок HttpClient
   * 
   * Использование в компонентах:
   * ```typescript
   * this.avatarService.getAvailableAvatars().subscribe(avatars => {
   *   this.availableAvatars = avatars;
   * });
   * ```
   */
  getAvailableAvatars(): Observable<string[]> {
    /**
     * Выполнение HTTP GET запроса к бэкенд API
     * Эндпоинт: {API_URL}/avatars
     * Ожидаемый ответ: массив строк (имена файлов аватаров)
     */
    return this.http.get<string[]>(`${this.API_URL}/avatars`);
  }
}