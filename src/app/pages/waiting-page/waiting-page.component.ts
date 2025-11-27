import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

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

  /**
   * Флаг истечения времени ожидания
   * Устанавливается true при достижении maxWaitTime
   */
  timeExpired = false;

  /**
   * Конструктор компонента
   * @param router - Сервис маршрутизации для навигации между страницами
   */
  constructor(private router: Router) {
    // Получаем имя оппонента из query параметров навигации
    const navigation = this.router.getCurrentNavigation();
    this.opponentName = navigation?.extras?.queryParams?.['opponent'] || null;
  }

  /**
   * Метод инициализации компонента
   * Запускает все необходимые таймеры и процессы ожидания
   */
  ngOnInit() {
    // Запускаем таймер для отсчета времени ожидания (обновление каждую секунду)
    this.timer = setInterval(() => {
      this.waitingTime++;
      this.checkTimeout();
    }, 1000);

    // Запускаем таймаут на максимальное время ожидания
    this.timeoutTimer = setTimeout(() => {
      this.handleTimeout();
    }, this.maxWaitTime * 1000);

    // Запускаем периодическую проверку подключения соперника
    this.startWaitingCheck();
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
   * Запуск периодической проверки подключения противника
   * В текущей реализации используется mock-логика (реальных пока нет)
   * TODO: Заменить на реальные API запросы или WebSocket соединение
   */
  startWaitingCheck() {
    // Mock: проверка подключения каждые 3 секунды
    this.checkInterval = setInterval(() => {
      this.checkOpponentConnection();
    }, 3000);
  }

  /**
   * Проверка подключения противника
   * В текущей реализации эмулирует случайное время подключения
   * TODO: Интегрировать с реальной системой уведомлений о подключении?
   */
  checkOpponentConnection() {
    // TODO: Заменить на реальный API запрос или WebSocket
    console.log('Проверка подключения соперника...');
    
    // Mock: через случайное время "находим" соперника
    // В реальном приложении это будет приходить от сервера
    const randomTime = Math.random() * 10000 + 5000; // 5-15 секунд
    setTimeout(() => {
      // TODO: Раскомментировать когда будет готов бэкенд
      // this.opponentFound();
    }, randomTime);
  }

  /**
   * Обработчик успешного подключения противника
   * Выполняет очистку таймеров и навигацию к игровому процессу
   * TODO: Реализовать переход на реальную игровую сессию
   */
  opponentFound() {
    console.log('Соперник найден! Начинаем игру...');
    this.clearAllTimers();
    
    // TODO: Переход на страницу игры когда соперник найден
    // this.router.navigate(['/game'], {
    //   queryParams: { opponent: this.opponentName }
    // });
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