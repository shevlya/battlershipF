import { Component, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { AvatarService } from '../../services/avatar.service';

/**
 * Компонент страницы смены аватара пользователя
 * 
 * Основные функции:
 * - Отображение текущего аватара пользователя
 * - Загрузка и отображение доступных аватаров
 * - Выбор нового аватара из коллекции
 * - Обновление аватара пользователя на сервере
 * - Навигация обратно в профиль после успешной смены
 * 
 * @component
 * @selector app-change-avatar-page
 * 
 * Особенности работы:
 * - Интеграция с AvatarService для получения списка аватаров
 * - Использование AuthService для обновления данных пользователя
 * - Fallback механизм при ошибках загрузки аватаров
 * - Визуальное выделение выбранного аватара
 */
@Component({
  selector: 'app-change-avatar-page',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './change-avatar-page.component.html',
  styleUrl: './change-avatar-page.component.scss'
})
export class ChangeAvatarPageComponent implements OnInit {
  /** Никнейм текущего пользователя для отображения */
  username = '';

  /** Текущий аватар пользователя (URL файла) */
  currentAvatar: string | null = null;

  /** Выбранный пользователем новый аватар */
  selectedAvatar: string | null = null;
  
  /** Базовый путь к папке с аватарами на фронтенде */
  private readonly AVATAR_BASE_PATH = '/assets/avatars/';

  /** Массив доступных для выбора аватаров */
  availableAvatars: string[] = [];

  constructor(
    private router: Router,
    private authService: AuthService,
    private avatarService: AvatarService
  ) {}

  /**
   * Метод инициализации компонента
   * Выполняется при создании компонента
   * 
   * Процесс инициализации:
   * 1. Загрузка данных текущего пользователя
   * 2. Установка текущего аватара
   * 3. Загрузка списка доступных аватаров
   */
  ngOnInit() {
    // Загружаем данные текущего пользователя через getCurrentUser()
    const user = this.authService.getCurrentUser();
    if (user) {
      this.username = user.nickname;
      this.currentAvatar = user.avatarUrl || null; // Используем avatarUrl
      console.log('Текущий пользователь:', user);
    }

    this.loadAvailableAvatars();
  }

  /**
   * Загрузка списка доступных аватаров с сервера
   * 
   * Процесс загрузки:
   * 1. Запрос к AvatarService для получения списка аватаров
   * 2. Успешная загрузка - сохранение списка
   * 3. Ошибка загрузки - использование fallback списка
   * 
   * Fallback механизм:
   * - При ошибке сети или сервера используется предопределенный список
   * - Обеспечивает работу компонента даже при проблемах с бэкендом
   */
  loadAvailableAvatars() {
    this.avatarService.getAvailableAvatars().subscribe({
      next: (avatars) => {
        console.log('Загружены аватары с бэкенда:', avatars);
        this.availableAvatars = avatars;
      },
      error: (error) => {
        console.error('Ошибка загрузки аватаров:', error);
        // Fallback: предопределенный список аватаров
        this.availableAvatars = [
          'avatar1.jpg', 'avatar2.jpg', 'avatar3.jpg', 'avatar4.jpg', 'avatar5.jpg',
          'avatar6.jpg', 'avatar7.jpg', 'avatar8.jpg', 'avatar9.jpg', 'avatar10.jpg'
        ];
      }
    });
  }

  /**
   * Генерация инициалов пользователя для placeholder (раньше не было аватарки по умолчанию, оставила, чтобы те пользователи норм отображались)
   * Используется когда у пользователя нет аватара
   * 
   * @returns Первую букву никнейма в верхнем регистре или 'U' если никнейм отсутствует
   */
  getInitials(): string {
    if (!this.username || this.username.length === 0) {
      return 'U'; // 'U' для Unknown (Неизвестный пользователь)
    }
    return this.username.charAt(0).toUpperCase();
  }

  /**
   * Формирование полного пути к файлу аватара
   * 
   * @param avatarFileName - Имя файла аватара из базы данных
   * @returns Абсолютный путь к файлу аватара на фронтенде
   */
  getAvatarPath(avatarFileName: string | null): string {
    if (!avatarFileName) return '';
    return `${this.AVATAR_BASE_PATH}${avatarFileName}`;
  }

  /**
   * Выбор аватара пользователем
   * Устанавливает выбранный аватар и сбрасывает предыдущий выбор
   * 
   * @param avatar - Имя файла выбранного аватара
   */
  selectAvatar(avatar: string) {
    this.selectedAvatar = avatar;
  }

  /**
   * Основной метод смены аватара пользователя
   * 
   * Процесс смены аватара:
   * 1. Проверка что аватар выбран
   * 2. Отправка запроса на сервер через AuthService
   * 3. Обработка успешного ответа (обновление состояния, навигация)
   * 4. Обработка ошибок смены аватара
   * 
   * @throws {Error} При проблемах с сетью или сервером
   */
  changeAvatar() {
    // Проверка что пользователь выбрал новый аватар
    if (this.selectedAvatar) {
      console.log('Начинаем смену аватара на:', this.selectedAvatar);
      
      /**
       * Вызов сервиса для обновления аватара на сервере
       * Использует HTTP запрос с JWT токеном в заголовках
       */
      this.authService.updateAvatar(this.selectedAvatar).subscribe({
        next: (response) => {
          console.log('Аватар успешно изменен. Ответ сервера:', response);
          
          // Обновление состояния компонента
          this.currentAvatar = this.selectedAvatar;
          this.selectedAvatar = null;
          
          // Перенаправление на страницу профиля
          this.router.navigate(['/profile']);
        },
        error: (error) => {
          console.error('Ошибка при смене аватара:', error);
          alert('Ошибка при смене аватара. Попробуйте еще раз.');
        }
      });
    }
  }
}