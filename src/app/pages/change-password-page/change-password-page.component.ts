import { Component } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-change-password-page',
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule],
  templateUrl: './change-password-page.component.html',
  styleUrl: './change-password-page.component.scss'
})
export class ChangePasswordPageComponent {
  passwordData = {
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  constructor(private router: Router) {}

  changePassword() {
    // Валидация паролей
    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
      alert('Новые пароли не совпадают!');
      return;
    }

    if (this.passwordData.newPassword.length < 6) {
      alert('Новый пароль должен содержать минимум 6 символов!');
      return;
    }

    // Здесь будет логика смены пароля через API
    console.log('Смена пароля:', this.passwordData);
    
    // Временный alert для демонстрации
    alert('Пароль успешно изменен!');
    
    // После успешной смены пароля можно перейти в лобби
    this.router.navigate(['/lobby']);
  }
}