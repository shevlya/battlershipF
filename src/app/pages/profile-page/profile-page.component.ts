import { Component, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService, User } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Компонент страницы профиля пользователя
 * 
 * Основные функции:
 * - Отображение информации о пользователе (статистика, аватар)
 * - Загрузка актуальных данных с сервера
 * - Навигация к функциям изменения профиля
 * - Выход из системы
 * 
 * @component
 * @selector app-profile-page
 */
@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss'
})
export class ProfilePageComponent implements OnInit {
  /**
   * Данные текущего пользователя
   * Содержит основную информацию и статистику игрока
   */
  user: User = {
    player_id: 0,
    nickname: '',
    avatarUrl: null, // URL аватара пользователя
    totalGames: 0,   // Общее количество сыгранных игр
    wins: 0,         // Количество побед
    losses: 0,       // Количество поражений
    savedLayouts: 0  // Количество сохраненных расстановок
  };

 // TODO: нужно будет сделать подтягивание статистики. Для этого нужно подумать над сущностью в БД со статистикой

  /** Флаг загрузки данных */
  isLoading = true;

  constructor(
    private router: Router,
    private authService: AuthService,
    private http: HttpClient
  ) {}

  /**
   * Инициализация компонента
   * Загружает данные пользователя при создании компонента
   */
  ngOnInit() {
    this.loadUserData();
  }

  /**
   * Загрузка данных пользователя с сервера
   * 
   * Процесс загрузки:
   * 1. Получение JWT токена из AuthService
   * 2. Запрос к API для получения актуальных данных
   * 3. Преобразование данных в структуру компонента
   * 4. Обновление данных в AuthService
   * 5. Fallback на локальные данные при ошибке
   */
  loadUserData() {
    this.isLoading = true;
    
    // Получение токена аутентификации
    const token = this.authService.getToken();
    if (!token) {
      console.warn('Токен аутентификации не найден');
      this.isLoading = false;
      return;
    }

    // Настройка заголовков с токеном авторизации
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    /**
     * Запрос актуальных данных пользователя с сервера
     * Используется для получения свежей статистики и информации
     */
    this.http.get<any>(`${environment.apiUrl}/api/players/current`, { headers }).subscribe({
      next: (userData) => {
        console.log('Данные пользователя с сервера:', userData);
        
        // Преобразование данных сервера в структуру компонента
        this.user = {
          player_id: userData.playerId,
          nickname: userData.nickname,
          avatarUrl: userData.avatarUrl || null, // Обработка отсутствующего аватара
          totalGames: userData.totalGames || 0,
          wins: userData.wins || 0,
          losses: userData.losses || 0,
          savedLayouts: userData.savedLayouts || 0
        };
        
        this.isLoading = false;
        
        // Синхронизация данных с сервисом аутентификации
        this.authService.updateUser(this.user);
      },
      error: (error) => {
        console.error('Ошибка загрузки данных пользователя:', error);
        
        /**
         * Fallback механизм:
         * При ошибке загрузки с сервера используются данные из AuthService
         * Это обеспечивает работу компонента даже при проблемах с сетью
         */
        const userFromAuth = this.authService.getCurrentUser();
        if (userFromAuth) {
          console.log('Используем данные из AuthService:', userFromAuth);
          this.user = userFromAuth;
        }
        this.isLoading = false;
      }
    });
  }

  // ==================== МЕТОДЫ ОТОБРАЖЕНИЯ ====================

  /**
   * Генерация инициалов пользователя для placeholder аватара
   * Используется когда у пользователя нет установленного аватара
   * 
   * @returns Первую букву никнейма в верхнем регистре или 'U' если никнейм отсутствует
   */
  getInitials(): string {
    if (!this.user.nickname || this.user.nickname.length === 0) {
      return 'U'; // 'U' для Unknown (Неизвестный пользователь)
    }
    return this.user.nickname.charAt(0).toUpperCase();
  }

  /**
   * Формирование полного пути к файлу аватара
   * 
   * @param avatarUrl - Относительный путь к аватару из базы данных
   * @returns Абсолютный путь к файлу аватара в папке assets
   */
  getAvatarPath(avatarUrl: string | null): string {
    if (!avatarUrl) return '';
    return `/assets/avatars/${avatarUrl}`;
  }

  // ==================== МЕТОДЫ НАВИГАЦИИ ====================

  /**
   * Навигация на страницу изменения аватара
   * Позволяет пользователю выбрать новый аватар
   */
  changeAvatar() {
    this.router.navigate(['/change-avatar']);
  }

  /**
   * Навигация на страницу изменения пароля
   * Позволяет пользователю установить новый пароль
   */
  changePassword() {
    this.router.navigate(['/change-password']);
  }

  /**
   * Выход из системы
   * 
   * Процесс выхода:
   * 1. Вызов logout() в AuthService для очистки токена
   * 2. Перенаправление на главную страницу
   * 3. Автоматическая перезагрузка страницы для сброса состояния
   */
  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}