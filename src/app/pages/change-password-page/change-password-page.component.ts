// change-password-page.component.ts
import { Component } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

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

  isLoading = false;
  success = false;

  // Ошибки (как в регистрации)
  fieldsEmpty = false;
  passwordMismatch = false;
  passwordTooShort = false;
  sameAsOld = false;
  oldPasswordIncorrect = false;
  generalError = '';

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  changePassword() {
    // Сброс ошибок и успеха
    this.clearErrors();
    this.success = false;

    // Валидация паролей (как в регистрации)
    if (!this.passwordData.oldPassword || !this.passwordData.newPassword || !this.passwordData.confirmPassword) {
      this.fieldsEmpty = true;
      return;
    }

    if (this.passwordData.newPassword.length < 6) {
      this.passwordTooShort = true;
      return;
    }

    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
      this.passwordMismatch = true;
      return;
    }

    if (this.passwordData.oldPassword === this.passwordData.newPassword) {
      this.sameAsOld = true;
      return;
    }

    this.isLoading = true;

    // Вызов метода смены пароля через API
    this.authService.changePassword(this.passwordData.oldPassword, this.passwordData.newPassword).subscribe({
      next: (response) => {
        console.log('Пароль успешно изменен:', response);
        this.isLoading = false;
        this.success = true;
        
        // Очистка формы
        this.passwordData = {
          oldPassword: '',
          newPassword: '',
          confirmPassword: ''
        };

        // Автоматическое перенаправление через 2 секунды
        setTimeout(() => {
          this.router.navigate(['/profile']);
        }, 2000);
      },
      error: (error) => {
        console.error('Ошибка при смене пароля:', error);
        this.isLoading = false;
        
        if (error.status === 400) {
          if (error.error?.message === 'Неверный старый пароль') {
            this.oldPasswordIncorrect = true;
          } else {
            this.generalError = error.error?.message || 'Ошибка при смене пароля';
          }
        } else if (error.status === 401) {
          this.generalError = 'Сессия истекла. Пожалуйста, войдите снова.';
        } else {
          this.generalError = 'Произошла ошибка при смене пароля. Попробуйте еще раз.';
        }
      }
    });
  }

  // Метод для очистки ошибок при вводе (как в регистрации)
  clearErrors() {
    this.fieldsEmpty = false;
    this.passwordMismatch = false;
    this.passwordTooShort = false;
    this.sameAsOld = false;
    this.oldPasswordIncorrect = false;
    this.generalError = '';
  }
}