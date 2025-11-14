import { Component, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService, User } from '../../services/auth.service';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss'
})
export class ProfilePageComponent implements OnInit {
  user: User = {
    player_id: 0,
    nickname: '',
    avatarUrl: null, // Изменяем на avatarUrl
    totalGames: 0,
    wins: 0,
    losses: 0,
    savedLayouts: 0
  };

  isLoading = true;

  constructor(
    private router: Router,
    private authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.loadUserData();
  }

  loadUserData() {
    this.isLoading = true;
    
    const token = this.authService.getToken();
    if (!token) {
      this.isLoading = false;
      return;
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    // Загружаем актуальные данные пользователя с сервера
    this.http.get<any>('http://10.0.0.2:8080/api/players/current', { headers }).subscribe({
      next: (userData) => {
        console.log('Данные пользователя с сервера:', userData);
        
        // Преобразуем данные с сервера в нашу структуру
        this.user = {
          player_id: userData.playerId,
          nickname: userData.nickname,
          avatarUrl: userData.avatarUrl || null, // Используем avatarUrl с сервера
          totalGames: userData.totalGames || 0,
          wins: userData.wins || 0,
          losses: userData.losses || 0,
          savedLayouts: userData.savedLayouts || 0
        };
        
        this.isLoading = false;
        
        // Обновляем данные в AuthService
        this.authService.updateUser(this.user);
      },
      error: (error) => {
        console.error('Ошибка загрузки данных пользователя:', error);
        
        // Fallback: используем данные из AuthService
        const userFromAuth = this.authService.getCurrentUser();
        if (userFromAuth) {
          console.log('Используем данные из AuthService:', userFromAuth);
          this.user = userFromAuth;
        }
        this.isLoading = false;
      }
    });
  }

  getInitials(): string {
    if (!this.user.nickname || this.user.nickname.length === 0) {
      return 'U';
    }
    return this.user.nickname.charAt(0).toUpperCase();
  }

  // Метод для получения пути к аватару
  getAvatarPath(avatarUrl: string | null): string {
    if (!avatarUrl) return '';
    return `/assets/avatars/${avatarUrl}`;
  }

  changeAvatar() {
    this.router.navigate(['/change-avatar']);
  }

  changePassword() {
    this.router.navigate(['/change-password']);
  }
}