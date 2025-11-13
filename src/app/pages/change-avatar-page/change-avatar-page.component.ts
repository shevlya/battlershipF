// change-avatar-page.component.ts
import { Component, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { AvatarService } from '../../services/avatar.service';

@Component({
  selector: 'app-change-avatar-page',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './change-avatar-page.component.html',
  styleUrl: './change-avatar-page.component.scss'
})
export class ChangeAvatarPageComponent implements OnInit {
  username = '';
  currentAvatar: string | null = null;
  selectedAvatar: string | null = null;
  
  private readonly AVATAR_BASE_PATH = '/assets/avatars/';
  availableAvatars: string[] = [];

  constructor(
    private router: Router,
    private authService: AuthService,
    private avatarService: AvatarService
  ) {}

  ngOnInit() {
    // Загружаем данные текущего пользователя через getCurrentUser()
    const user = this.authService.getCurrentUser();
    if (user) {
      this.username = user.nickname;
      this.currentAvatar = user.avatarUrl || null; // Используем avatarUrl
      console.log('Текущий пользователь:', user);
    }

    this.loadAvailableAvatars();
  }

  loadAvailableAvatars() {
    this.avatarService.getAvailableAvatars().subscribe({
      next: (avatars) => {
        console.log('Загружены аватары с бэкенда:', avatars);
        this.availableAvatars = avatars;
      },
      error: (error) => {
        console.error('Ошибка загрузки аватаров:', error);
        this.availableAvatars = [
          'avatar1.jpg', 'avatar2.jpg', 'avatar3.jpg', 'avatar4.jpg', 'avatar5.jpg',
          'avatar6.jpg', 'avatar7.jpg', 'avatar8.jpg', 'avatar9.jpg', 'avatar10.jpg'
        ];
      }
    });
  }

  getInitials(): string {
    if (!this.username || this.username.length === 0) {
      return 'U';
    }
    return this.username.charAt(0).toUpperCase();
  }

  getAvatarPath(avatarFileName: string | null): string {
    if (!avatarFileName) return '';
    return `${this.AVATAR_BASE_PATH}${avatarFileName}`;
  }

  selectAvatar(avatar: string) {
    this.selectedAvatar = avatar;
  }

  changeAvatar() {
    if (this.selectedAvatar) {
      console.log('Начинаем смену аватара на:', this.selectedAvatar);
      
      this.authService.updateAvatar(this.selectedAvatar).subscribe({
        next: (response) => {
          console.log('Аватар успешно изменен. Ответ сервера:', response);
          
          // Обновляем текущий аватар
          this.currentAvatar = this.selectedAvatar;
          this.selectedAvatar = null;
          
          // Перенаправляем в лобби
          this.router.navigate(['/profile']);
        },
        error: (error) => {
          console.error('Ошибка при смене аватара:', error);
          alert('Ошибка при смене аватара. Попробуйте еще раз.');
        }
      });
    }
  }
}