import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-waiting-page',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './waiting-page.component.html',
  styleUrl: './waiting-page.component.scss'
})
export class WaitingPageComponent implements OnInit, OnDestroy {
  private checkInterval: any;
  private timer: any;
  private timeoutTimer: any;
  
  waitingTime = 0;
  foundPlayers = 0;
  maxWaitTime = 60; // Максимальное время ожидания в секундах
  opponentName: string | null = null;
  timeExpired = false;

  constructor(private router: Router) {
    // Получаем имя оппонента из query параметров
    const navigation = this.router.getCurrentNavigation();
    this.opponentName = navigation?.extras?.queryParams?.['opponent'] || null;
  }

  ngOnInit() {
    // Запускаем таймер для отсчета времени ожидания
    this.timer = setInterval(() => {
      this.waitingTime++;
      this.checkTimeout();
    }, 1000);

    // Запускаем таймаут на 60 секунд
    this.timeoutTimer = setTimeout(() => {
      this.handleTimeout();
    }, this.maxWaitTime * 1000);

    // Запускаем проверку подключения соперника
    this.startWaitingCheck();
  }

  ngOnDestroy() {
    this.clearAllTimers();
  }

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

  private checkTimeout() {
    // Проверяем, не превысило ли время ожидания лимит
    if (this.waitingTime >= this.maxWaitTime && !this.timeExpired) {
      this.handleTimeout();
    }
  }

  private handleTimeout() {
    console.log('Время ожидания истекло');
    this.timeExpired = true;
    this.clearAllTimers();
    
    // Показываем сообщение об истечении времени
    setTimeout(() => {
      this.router.navigate(['/multiplayer'], {
        queryParams: { timeout: true }
      });
    }, 2000); // Даем пользователю увидеть сообщение
  }

  startWaitingCheck() {
    // Mock: проверка каждые 3 секунды
    this.checkInterval = setInterval(() => {
      this.checkOpponentConnection();
    }, 3000);
  }

  checkOpponentConnection() {
    // TODO: Заменить на реальный API запрос или WebSocket
    console.log('Проверка подключения соперника...');
    
    // Mock: через случайное время "находим" соперника
    // В реальном приложении это будет приходить от сервера
    const randomTime = Math.random() * 10000 + 5000; // 5-15 секунд
    setTimeout(() => {
      // Раскомментировать когда будет готов бэкенд
      // this.opponentFound();
    }, randomTime);
  }

  opponentFound() {
    console.log('Соперник найден! Начинаем игру...');
    this.clearAllTimers();
    
    // TODO: Переход на страницу игры когда соперник найден
    // this.router.navigate(['/game'], {
    //   queryParams: { opponent: this.opponentName }
    // });
  }

  cancelWaiting() {
    console.log('Ожидание отменено');
    this.clearAllTimers();
    
    // Возвращаемся в мультиплеер
    this.router.navigate(['/multiplayer']);
  }

  // Получение оставшегося времени
  getRemainingTime(): number {
    return Math.max(0, this.maxWaitTime - this.waitingTime);
  }
}