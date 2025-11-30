import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule, ActivatedRoute  } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  WebSocketService,
  GameStartNotification
} from '../../services/webSocket.service';
import { AuthService } from '../../services/auth.service';
/**
 * Компонент страницы ожидания подключения противника
 *
 * Основные функции:
 * - Ожидание подтверждения игры от приглашенного противника
 * - Отсчет времени с автоматическим завершением при превышении лимита
 * - Визуальное отображение процесса ожидания
 * - Обработка отмены ожидания пользователем
 * - Навигация к игре при успешном подключении противника
 *
 * @component
 * @selector app-waiting-page
 *
 * Особенности:
 * - Множественные таймеры для разных аспектов ожидания
 * - Автоматическая очистка ресурсов при уничтожении компонента
 * - Интеграция с системой мультиплеерных игр
 */
@Component({
  selector: 'app-waiting-page',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './waiting-page.component.html',
  styleUrl: './waiting-page.component.scss'
})
export class WaitingPageComponent implements OnInit, OnDestroy {
  /**
   * Интервал для периодической проверки подключения противника
   */
  private checkInterval: any;

  /**
   * Таймер для отсчета общего времени ожидания
   */
  private timer: any;

  /**
   * Таймер для автоматического завершения ожидания по таймауту
   */
  private timeoutTimer: any;

  /**
   * Общее время ожидания в секундах
   * Увеличивается каждую секунду для отображения прогресса
   */
  waitingTime = 0;

  /**
   * Количество найденных игроков (пока не используется)
   * В текущей реализации всегда 0
   */
  foundPlayers = 0;

  /**
   * Максимальное время ожидания в секундах
   * При достижении этого значения ожидание автоматически завершается
   */
  maxWaitTime = 60;

  /**
   * Имя приглашенного противника
   * Получается из query параметров навигации
   */
  opponentName: string | null = null;
  private wsSubscriptionsInitialized = false;
  /**
   * Флаг истечения времени ожидания
   * Устанавливается true при достижении maxWaitTime
   */
  timeExpired = false;

  /**
   * Конструктор компонента
   * @param router - Сервис маршрутизации для навигации между страницами
   */
  constructor( private router: Router,
               private route: ActivatedRoute,
               private ws: WebSocketService,
               private authService: AuthService) {
    // Получаем имя оппонента из query параметров навигации
    const navigation = this.router.getCurrentNavigation();
    this.opponentName = navigation?.extras?.queryParams?.['opponent'] || null;
  }

  /**
   * Метод инициализации компонента
   * Запускает все необходимые таймеры и процессы ожидания
   */
  ngOnInit() {
    // просто визуальный таймер
    this.timer = setInterval(() => {
      this.waitingTime++;
      this.checkTimeout();
    }, 1000);

    this.timeoutTimer = setTimeout(() => {
      this.handleTimeout();
    }, this.maxWaitTime * 1000);

    // === КЛЮЧЕВОЕ: подписки на WebSocket для инициатора ===
    const user = this.authService.getCurrentUser();
    const playerId = Number(user?.player_id);

    if (!playerId) {
      console.warn('WaitingPage: не удалось получить player_id, отправляем на логин');
      this.router.navigate(['/login']);
      return;
    }

    const initSubscriptions = () => {
      if (this.wsSubscriptionsInitialized) return;
      this.wsSubscriptionsInitialized = true;

      // 1) игра принята — уведомление получают ОБА игрока
      this.ws.subscribeToGameStart((game: GameStartNotification) => {
        console.log('WaitingPage: игра начинается', game);
        this.clearAllTimers();

        this.router.navigate(['/placement'], {
          queryParams: {
            opponentId: game.opponentId,
            opponentNickname: game.opponentNickname
          }
        });
      });

      // 2) приглашение отклонено — это видит только инициатор
      this.ws.subscribeToRejection((game: GameStartNotification) => {
        console.log('WaitingPage: приглашение отклонено', game);
        this.clearAllTimers();

        this.router.navigate(['/multiplayer'], {
          queryParams: { inviteRejected: true }
        });
      });
    };

    // если WS ещё не подключен — подключаем и потом вешаем подписки
    if (!this.ws.isConnected()) {
      this.ws.connect(playerId)
        .then(() => {
          console.log('WaitingPage: WebSocket подключен');
          initSubscriptions();
        })
        .catch(err => {
          console.error('WaitingPage: не удалось подключиться к WebSocket', err);
          // на всякий случай вернём игрока назад
          this.handleTimeout();
        });
    } else {
      // уже подключены — только вешаем подписки
      initSubscriptions();
    }
  }



  /**
   * Метод очистки ресурсов компонента (освобождение всех таймеров при уничтожении компонента)
   */
  ngOnDestroy() {
    this.clearAllTimers();
  }

  /**
   * Полная очистка всех активных таймеров (предотвращение утечки памяти и выполнение кода после уничтожения компонента)
   */
  private clearAllTimers() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    if (this.timer) {
      clearInterval(this.timer);
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
    }
  }

  /**
   * Проверка достижения лимита времени ожидания
   * Вызывается каждую секунду для мониторинга прогресса
   */
  private checkTimeout() {
    // Проверяем, не превысило ли время ожидания лимит
    if (this.waitingTime >= this.maxWaitTime && !this.timeExpired) {
      this.handleTimeout();
    }
  }

  /**
   * Обработчик истечения времени ожидания
   * Выполняет очистку таймеров и навигацию с сообщением о таймауте
   */
  private handleTimeout() {
    console.log('Время ожидания истекло');
    this.timeExpired = true;
    this.clearAllTimers();

    // Показываем сообщение об истечении времени в течение 2 секунд
    setTimeout(() => {
      this.router.navigate(['/multiplayer'], {
        queryParams: { timeout: true }
      });
    }, 2000);
  }


  /**
   * Метод отмены ожидания по инициативе пользователя
   * Выполняет очистку ресурсов и возврат в меню мультиплеера
   */
  cancelWaiting() {
    console.log('Ожидание отменено');
    this.clearAllTimers();

    // Возвращаемся в меню мультиплеера
    this.router.navigate(['/multiplayer']);
  }

  /**
   * Расчет оставшегося времени ожидания
   * @returns Количество секунд до автоматического завершения ожидания
   */
  getRemainingTime(): number {
    return Math.max(0, this.maxWaitTime - this.waitingTime);
  }
}
