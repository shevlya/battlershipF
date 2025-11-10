import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface Player {
  id: number;
  username: string;
  avatar: string;
  isOnline: boolean;
}

@Component({
  selector: 'app-multiplayer-page',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './multiplayer-page.component.html',
  styleUrl: './multiplayer-page.component.scss'
})
export class MultiplayerPageComponent implements OnInit {
  players: Player[] = [];

  ngOnInit() {
    // TODO: Заменить на реальный API запрос к серверу
    this.loadPlayers();
  }

  loadPlayers() {
    // Mock данные - потом заменить на реальные с сервера
    this.players = [
      {
        id: 1,
        username: 'pashaTechnika',
        avatar: '/assets/avatars/user1.jpg',
        isOnline: true
      },
      {
        id: 2,
        username: 'nikChivk',
        avatar: '/assets/avatars/user2.jpg',
        isOnline: true
      },
      {
        id: 3,
        username: 'annaSea',
        avatar: '/assets/avatars/user3.jpg',
        isOnline: false
      },
      {
        id: 4,
        username: 'maxBattle',
        avatar: '/assets/avatars/user4.jpg',
        isOnline: true
      }
    ];
  }
  constructor(private router: Router) {}

  invitePlayer(player: Player) {
    console.log('Приглашение отправлено игроку:', player.username);
    
    // Переход на страницу ожидания
    this.router.navigate(['/waiting']);
    
    // Здесь будет вызов API для отправки приглашения
    // this.gameService.invitePlayer(player.id).subscribe(...)
  }

  startGame() {
    // TODO: Реализовать логику начала игры
    console.log('Начало игры');
    
    // Здесь будет логика начала игры
    // this.router.navigate(['/game']);
  }
}