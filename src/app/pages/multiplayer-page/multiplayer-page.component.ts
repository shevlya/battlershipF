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
  paginatedPlayers: Player[] = [];
  currentPlayer: any = null;
  loading = true;
  error = '';

  currentPage = 1;
  pageSize = 4;
  totalPages = 1;

  // Выбранный игрок
  selectedPlayerId: number | null = null;

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
          const currentUserId = Number(this.currentPlayer.playerId || this.currentPlayer.id || this.currentPlayer.player_id);
          this.players = players.filter(player => 
            Number(player.playerId) !== currentUserId
          );
        } else {
          this.players = players;
        }
        
        this.updatePagination();
        this.loading = false;
        this.error = '';
        console.log('Отфильтрованный список игроков:', this.players);
        console.log('Текущий пользователь ID:', this.currentPlayer ? 
          (this.currentPlayer.playerId || this.currentPlayer.id || this.currentPlayer.player_id) : 'не определен');
      },
      error: (err) => {
        console.error('Ошибка при загрузке игроков:', err);
        this.error = 'Не удалось загрузить список игроков';
        this.loading = false;
        this.players = [];
        this.paginatedPlayers = [];
      }
    });
  }

  // Выбор игрока
  selectPlayer(playerId: number) {
    this.selectedPlayerId = playerId;
    console.log('Выбран игрок с ID:', playerId);
  }

  // Приглашение выбранного игрока
  inviteSelectedPlayer() {
    if (!this.selectedPlayerId) return;

    const selectedPlayer = this.players.find(player => player.playerId === this.selectedPlayerId);
    if (selectedPlayer) {
      console.log('Приглашение отправлено игроку:', selectedPlayer.nickname);
      
      this.router.navigate(['/waiting'], { 
        queryParams: { opponent: selectedPlayer.nickname } 
      });
    }
  }

  // Обновление пагинации
  updatePagination() {
    this.totalPages = Math.ceil(this.players.length / this.pageSize);
    this.currentPage = Math.min(this.currentPage, this.totalPages) || 1;
    
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedPlayers = this.players.slice(startIndex, endIndex);
  }

  // Переход на предыдущую страницу
  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  // Переход на следующую страницу
  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  // Переход на конкретную страницу
  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  // Получение номеров страниц для отображения
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    
    // Корректируем начальную страницу, если мы в конце
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
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
}