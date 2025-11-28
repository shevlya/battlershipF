import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

/**
 * Интерфейс для представления данных игрока
 * Используется для отображения информации о пригласившем пользователе
 */
interface Player {
  id: number;
  username: string;
  avatar: string;
  rating?: number;     //  рейтинг игрока (не используется пока)
  gamesPlayed?: number; //  количество сыгранных игр (не используется пока)
}

/**
 * Интерфейс для представления игрового приглашения
 * Содержит всю необходимую информацию о приглашении на игру
 */
interface Invitation {
  id: number;          // Уникальный идентификатор приглашения
  inviter: Player;     // Игрок, отправивший приглашение
  timestamp: string;   // Время отправки приглашения
  expiresIn: number;   // Время жизни приглашения в секундах
}

/**
 * Компонент страницы принятия игрового приглашения
 * 
 * Основные функции:
 * - Загрузка и отображение информации о приглашении
 * - Обратный отсчет времени для принятия решения
 * - Принятие или отклонение игрового приглашения
 * - Автоматическое отклонение при истечении времени
 * - Навигация к игре при принятии приглашения
 * 
 * @component
 * @selector app-accept-game
 * 
 * Жизненный цикл:
 * - OnInit: загрузка приглашения и запуск таймера
 * - OnDestroy: очистка таймера для предотвращения утечек памяти
 */
@Component({
  selector: 'app-accept-game',
  standalone: true,
  imports: [RouterModule, CommonModule, HttpClientModule],
  templateUrl: './accept-game-page.component.html',
  styleUrl: './accept-game-page.component.scss'
})
export class AcceptGameComponent implements OnInit, OnDestroy {  
  /**
   * Текущее загруженное приглашение
   * null - приглашение не загружено или не найдено
   */
  invitation: Invitation | null = null;

  /**
   * Флаг состояния загрузки данных
   * true - данные загружаются, false - загрузка завершена
   */
  isLoading = true;

  /**
   * Сообщение об ошибке при загрузке или обработке приглашения
   */
  errorMessage = '';

  /**
   * Оставшееся время для принятия решения (в секундах)
   * Начальное значение: 60 секунд
   */
  timeLeft = 60;

  /**
   * Ссылка на интервал таймера для очистки при уничтожении компонента
   */
  private timer: any;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient
  ) {}

  /**
   * Метод инициализации компонента
   * Вызывается автоматически при создании компонента
   * 
   * Выполняемые действия:
   * 1. Загрузка данных приглашения по ID из URL
   * 2. Запуск таймера обратного отсчета
   */
  ngOnInit() {
    this.loadInvitation();
    this.startTimer();
  }

  /**
   * Метод очистки ресурсов компонента
   * Вызывается автоматически при уничтожении компонента (предотвращает утечку памяти через неочищенный таймер)
   */
  ngOnDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  /**
   * Загрузка данных приглашения с сервера
   * 
   * Процесс загрузки:
   * 1. Получение ID приглашения из параметров URL
   * 2. Валидация наличия ID
   * 3. HTTP запрос к API для получения данных приглашения
   * 4. Обработка успешного ответа
   * 5. Обработка ошибок загрузки
   */
  loadInvitation() {
    // Получаем ID приглашения из параметров URL
    const inviteId = this.route.snapshot.paramMap.get('id');
    
    // Валидация наличия ID приглашения
    if (!inviteId) {
      this.errorMessage = 'Приглашение не найдено';
      this.isLoading = false;
      return;
    }

    // TODO: Заменить на реальный эндпоинт API
    this.http.get<Invitation>(`/api/invitations/${inviteId}`).subscribe({
      next: (invitation) => {
        this.invitation = invitation;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Ошибка загрузки приглашения:', error);
        this.errorMessage = 'Не удалось загрузить приглашение';
        this.isLoading = false;
      }
    });
  }

  /**
   * Запуск таймера обратного отсчета
   * 
   * Логика таймера:
   * - Уменьшает timeLeft каждую секунду
   * - При достижении 0 автоматически отклоняет приглашение
   * - Использует setInterval для периодического выполнения
   */
  startTimer() {
    this.timer = setInterval(() => {
      this.timeLeft--;
      
      // Автоматическое отклонение при истечении времени
      if (this.timeLeft <= 0) {
        this.rejectInvite();
      }
    }, 1000);
  }

  /**
   * Метод принятия игрового приглашения
   * 
   * Процесс принятия:
   * 1. Проверка наличия приглашения
   * 2. Отправка запроса на сервер о принятии
   * 3. При успехе - навигация на страницу подготовки к игре
   * 4. При ошибке - уведомление пользователя
   */
  acceptInvite() {
    if (!this.invitation) return;

    // TODO: Заменить на реальный эндпоинт
    this.http.post(`/api/invitations/${this.invitation.id}/accept`, {}).subscribe({
      next: () => {
        console.log('Приглашение принято');
        
        // Переход на страницу расстановки кораблей
        this.router.navigate(['/placement'], { 
          queryParams: { 
            opponentId: this.invitation?.inviter.id 
          } 
        });
      },
      error: (error) => {
        console.error('Ошибка принятия приглашения:', error);
        alert('Не удалось принять приглашение');
      }
    });
  }

  /**
   * Метод отклонения игрового приглашения
   * 
   * Процесс отклонения:
   * 1. Проверка наличия приглашения
   * 2. Отправка запроса на сервер об отклонении
   * 3. Навигация обратно в лобби
   * 4. Обработка ошибок с гарантированной навигацией в лобби
   */
  rejectInvite() {
    // Если приглашение не загружено, просто переходим в лобби
    if (!this.invitation) {
      this.router.navigate(['/lobby']);
      return;
    }

    // TODO: Заменить на реальный эндпоинт
    this.http.post(`/api/invitations/${this.invitation.id}/reject`, {}).subscribe({
      next: () => {
        console.log('Приглашение отклонено');
        this.router.navigate(['/lobby']);
      },
      error: (error) => {
        console.error('Ошибка отклонения приглашения:', error);
        
        // Даже при ошибке отправки переходим в лобби
        this.router.navigate(['/lobby']);
      }
    });
  }

  /**
   * Вспомогательный метод для навигации в лобби
   * Используется в шаблоне для кнопки "Вернуться в лобби"
   */
  navigateToLobby() {
    this.router.navigate(['/lobby']);
  }

  /**
   * Обработчик ошибки загрузки изображения аватара
   * Устанавливает изображение-заглушку при невозможности загрузить аватар
   * 
   * @param event - Событие ошибки загрузки изображения
   */
  handleImageError(event: any) {
    event.target.src = '/assets/avatars/defavatar.jpg';
  }
}