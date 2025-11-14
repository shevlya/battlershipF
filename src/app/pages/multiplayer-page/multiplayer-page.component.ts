import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PlayerService, Player } from '../../services/player.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-multiplayer-page',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './multiplayer-page.component.html',
  styleUrl: './multiplayer-page.component.scss'
})
export class MultiplayerPageComponent implements OnInit {
  players: Player[] = [];
  currentPlayer: any = null;
  loading = true;
  error = '';

  constructor(
    private router: Router,
    private playerService: PlayerService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadCurrentPlayer();
    this.loadPlayers();
  }

  loadCurrentPlayer() {
    this.currentPlayer = this.authService.getCurrentUser();
    console.log('Текущий пользователь:', this.currentPlayer);
  }

  loadPlayers() {
    this.loading = true;
    this.playerService.getAllPlayers().subscribe({
      next: (players) => {
        console.log('Загружены игроки из БД:', players);
        
        // Исключаем текущего игрока из списка
        if (this.currentPlayer) {
          this.players = players.filter(player => 
            player.playerId !== this.currentPlayer.player_id
          );
        } else {
          this.players = players;
        }
        
        this.loading = false;
        this.error = '';
        console.log('Отфильтрованный список игроков:', this.players);
      },
      error: (err) => {
        console.error('Ошибка при загрузке игроков:', err);
        this.error = 'Не удалось загрузить список игроков';
        this.loading = false;
        this.players = [];
      }
    });
  }

  // Метод для получения пути к аватару
  getAvatarPath(avatarUrl: string | null): string {
    if (!avatarUrl) return '';
    return `/assets/avatars/${avatarUrl}`;
  }

  // Получение инициалов для placeholder
  getInitials(nickname: string): string {
    if (!nickname || nickname.length === 0) {
      return 'U';
    }
    return nickname.charAt(0).toUpperCase();
  }

  // Генерация цвета на основе nickname для consistency
  getAvatarColor(nickname: string): string {
    if (!nickname) return '#9E9E9E';
    
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
    ];
    
    let hash = 0;
    for (let i = 0; i < nickname.length; i++) {
      hash = nickname.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }

  invitePlayer(player: Player) {
    console.log('Приглашение отправлено игроку:', player.nickname);
    
    this.router.navigate(['/waiting'], { 
      queryParams: { opponent: player.nickname } 
    });
  }
}