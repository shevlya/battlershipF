import { Component } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-change-avatar-page',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './change-avatar-page.component.html',
  styleUrl: './change-avatar-page.component.scss'
})
export class ChangeAvatarPageComponent {
  username = 'dollPlayer';
  currentAvatar = ''; // Текущий аватар пользователя
  selectedAvatar: string | null = null;
  
  // Заглушки для аватаров - в реальном приложении будут загружаться с сервера
  availableAvatars = [
    '/assets/avatars/avatar1.jpg',
    '/assets/avatars/avatar2.jpg',
    '/assets/avatars/avatar3.jpg',
    '/assets/avatars/avatar4.jpg',
    '/assets/avatars/avatar5.jpg',
    '/assets/avatars/avatar6.jpg',
    '/assets/avatars/avatar7.jpg',
    '/assets/avatars/avatar8.jpg',
    '/assets/avatars/avatar9.jpg',
    '/assets/avatars/avatar10.jpg'
  ];

  constructor(private router: Router) {}

  getInitials(): string {
    if (!this.username || this.username.length === 0) {
      return 'U';
    }
    return this.username.charAt(0).toUpperCase();
  }

  selectAvatar(avatar: string) {
    this.selectedAvatar = avatar;
  }

  changeAvatar() {
    if (this.selectedAvatar) {
      // Здесь будет логика сохранения выбранного аватара через API
      console.log('Смена аватара на:', this.selectedAvatar);
      
      // Временный alert для демонстрации
      alert('Аватар успешно изменен!');
      
      // Обновляем текущий аватар
      this.currentAvatar = this.selectedAvatar;
      
      // После успешной смены аватара можно перейти в лобби
      this.router.navigate(['/lobby']);
    }
  }
}