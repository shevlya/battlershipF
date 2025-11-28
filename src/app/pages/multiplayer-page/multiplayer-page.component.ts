import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { PlayerService, Player } from '../../services/player.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

/**
 * Компонент страницы мультиплеера для выбора противника
 * 
 * Основные функции:
 * - Отображение списка доступных игроков
 * - Пагинация списка игроков
 * - Выбор противника для игры
 * - Навигация на страницу ожидания игры
 * 
 * @component
 * @selector app-multiplayer-page
 */
@Component({
  selector: 'app-multiplayer-page',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './multiplayer-page.component.html',
  styleUrl: './multiplayer-page.component.scss'
})
export class MultiplayerPageComponent implements OnInit {
  /** Полный список игроков из базы данных */
  players: Player[] = [];
  
  /** Игроки для отображения на текущей странице пагинации */
  paginatedPlayers: Player[] = [];
  
  /** Текущий авторизованный пользователь */
  currentPlayer: any = null;
  
  /** Флаг загрузки данных */
  loading = true;
  
  /** Сообщение об ошибке */
  error = '';

  /** Текущая страница пагинации */
  currentPage = 1;
  
  /** Количество игроков на одной странице */
  pageSize = 4;
  
  /** Общее количество страниц */
  totalPages = 1;

  /** ID выбранного игрока для игры */
  selectedPlayerId: number | null = null;

  constructor(
    private router: Router,
    private playerService: PlayerService,
    private authService: AuthService,
    private http: HttpClient
  ) {}

  /**
   * Инициализация компонента
   * Загружает данные текущего пользователя и список всех игроков
   */
  ngOnInit() {
    this.loadCurrentUserData();
  }

  loadCurrentUserData() {
    this.loading = true;
    
    const token = this.authService.getToken();
    if (!token) {
      console.warn('Токен аутентификации не найден');
      this.loadPlayers();
      return;
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    this.http.get<any>(`${environment.apiUrl}/api/players/current`, { headers }).subscribe({
      next: (userData) => {
        console.log('Данные пользователя с сервера (мультиплеер):', userData);
        
        this.currentPlayer = {
          player_id: userData.playerId,
          nickname: userData.nickname,
          avatarUrl: userData.avatarUrl || null,
          totalGames: userData.totalGames || 0,
          wins: userData.wins || 0,
          losses: userData.losses || 0,
          savedLayouts: userData.savedLayouts || 0
        };
        
        this.authService.updateUser(this.currentPlayer);
        this.loadPlayers(); // Вызов остается только здесь
      },
      error: (error) => {
        console.error('Ошибка загрузки данных пользователя (мультиплеер):', error);
        this.currentPlayer = this.authService.getCurrentUser();
        console.log('Используем данные из AuthService:', this.currentPlayer);
        this.loadPlayers(); // И здесь
      }
    });
  }

  /**
   * Загрузка списка всех игроков из базы данных
   * Исключает текущего пользователя из списка доступных противников
   */
  loadPlayers() {
    this.playerService.getAllPlayers().subscribe({
      next: (players) => {
        console.log('Загружены игроки из БД:', players);
        
        // Исключаем текущего игрока из списка доступных противников
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

  /**
   * Выбор игрока из списка в качестве противника
   * @param playerId - ID выбранного игрока
   */
  selectPlayer(playerId: number) {
    this.selectedPlayerId = playerId;
    console.log('Выбран игрок с ID:', playerId);
  }

  /**
   * Отправка приглашения выбранному игроку
   * Переход на страницу ожидания ответа
   */
  inviteSelectedPlayer() {
    if (!this.selectedPlayerId) {
      console.warn('Попытка отправить приглашение без выбранного игрока');
      return;
    }

    const selectedPlayer = this.players.find(player => player.playerId === this.selectedPlayerId);
    if (selectedPlayer) {
      console.log('Приглашение отправлено игроку:', selectedPlayer.nickname);
      
      // Переход на страницу ожидания с передачей никнейма противника
      this.router.navigate(['/waiting'], { 
        queryParams: { opponent: selectedPlayer.nickname } 
      });
    } else {
      console.error('Выбранный игрок не найден в списке');
    }
  }

    /**
   * Обновление списка игроков
   * Перезагружает данные текущего пользователя и список всех игроков
   */
  refreshPlayers() {
    console.log('Обновление списка игроков...');
    this.loading = true;
    this.selectedPlayerId = null;
    this.error = '';
    
    // Сброс текущей страницы пагинации
    this.currentPage = 1;
    
    // Перезагрузка данных
    this.loadCurrentUserData();
  }

  // ==================== МЕТОДЫ ПАГИНАЦИИ ====================

  /**
   * Обновление данных пагинации на основе текущего списка игроков
   * Вычисляет общее количество страниц и отображаемых игроков
   */
  updatePagination() {
    this.totalPages = Math.ceil(this.players.length / this.pageSize);
    this.currentPage = Math.min(this.currentPage, this.totalPages) || 1;
    
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedPlayers = this.players.slice(startIndex, endIndex);
  }

  /**
   * Переход на предыдущую страницу списка игроков
   */
  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  /**
   * Переход на следующую страницу списка игроков
   */
  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  /**
   * Переход на конкретную страницу списка игроков
   * @param page - Номер страницы для перехода
   */
  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  /**
   * Генерация массива номеров страниц для отображения в пагинаторе
   * Ограничивает количество отображаемых страниц для удобства навигации
   * @returns Массив номеров страниц для отображения
   */
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5; // Максимальное количество отображаемых страниц
    
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    
    // Корректируем начальную страницу, если мы в конце списка
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  // ==================== МЕТОДЫ ОТОБРАЖЕНИЯ АВАТАРОВ ====================

  /**
   * Получение полного пути к файлу аватара пользователя
   * @param avatarUrl - Относительный путь к аватару из базы данных
   * @returns Полный путь к файлу аватара
   */
  getAvatarPath(avatarUrl: string | null): string {
    if (!avatarUrl) return '';
    return `/assets/avatars/${avatarUrl}`;
  }

  /**
   * Генерация инициалов пользователя для placeholder аватара (старые аватары в бд не имели аватарки, чтобы их не убирать внесены эти методы)
   * @param nickname - Никнейм пользователя
   * @returns Первая буква никнейма в верхнем регистре
   */
  getInitials(nickname: string): string {
    if (!nickname || nickname.length === 0) {
      return 'U'; // 'U' для Unknown (Неизвестный)
    }
    return nickname.charAt(0).toUpperCase();
  }

  /**
   * Генерация цвета для placeholder аватара на основе никнейма
   * Обеспечивает консистентность - один и тот же пользователь всегда будет иметь одинаковый цвет
   * @param nickname - Никнейм пользователя
   * @returns HEX-код цвета в формате #RRGGBB
   */
  getAvatarColor(nickname: string): string {
    if (!nickname) return '#9E9E9E'; // Серый цвет по умолчанию
    
    // Палитра приятных цветов для аватаров
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
    ];
    
    // Простой хэш-алгоритм для консистентного выбора цвета
    let hash = 0;
    for (let i = 0; i < nickname.length; i++) {
      hash = nickname.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Выбор цвета из палитры на основе хэша
    return colors[Math.abs(hash) % colors.length];
  }
}