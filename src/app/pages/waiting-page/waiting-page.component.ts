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
  
  waitingTime = 0;
  foundPlayers = 0;

  constructor(private router: Router) {}

  ngOnInit() {
    // Запускаем таймер для отсчета времени ожидания
    this.timer = setInterval(() => {
      this.waitingTime++;
    }, 1000);

    // Запускаем проверку подключения соперника
    this.startWaitingCheck();
  }

  ngOnDestroy() {
    // Очищаем все интервалы при уничтожении компонента
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    if (this.timer) {
      clearInterval(this.timer);
    }
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
    
    // Mock: через 10 секунд "находим" соперника
    // В реальном приложении это будет приходить от сервера
    setTimeout(() => {
      // this.opponentFound();
    }, 10000);
  }

  opponentFound() {
    // TODO: Переход на страницу игры когда соперник найден
    console.log('Соперник найден! Начинаем игру...');
    // this.router.navigate(['/game']);
  }

  cancelWaiting() {
    // TODO: Отправить запрос на сервер об отмене ожидания
    console.log('Ожидание отменено');
    
    // Очищаем все интервалы
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    if (this.timer) {
      clearInterval(this.timer);
    }
    
    // Возвращаемся в лобби
    this.router.navigate(['/lobby']);
  }
}