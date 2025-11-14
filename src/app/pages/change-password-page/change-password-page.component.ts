import { Component, OnInit } from '@angular/core';
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
export class ChangePasswordPageComponent implements OnInit {
  passwordData = {
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  isLoading = false;
  success = false;
  sessionExpired = false;

  // Ошибки валидации
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

  ngOnInit() {
    // Проверяем токен при загрузке компонента
    this.checkToken();
  }

  checkToken() {
    if (this.authService.isTokenExpired()) {
      this.sessionExpired = true;
      console.log('🔴 Токен просрочен, требуется перелогин');
    } else {
      console.log('🟢 Токен валиден');
    }
  }

  refreshSession() {
    console.log('🔄 Обновление сессии...');
    
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      // Сохраняем данные пользователя
      const username = currentUser.nickname;
      
      // Очищаем старые данные
      this.authService.logout();
      
      // Перенаправляем на логин
      this.router.navigate(['/login'], { 
        state: { 
          message: 'Пожалуйста, войдите снова для смены пароля',
          username: username 
        }
      });
    }
  }

  changePassword() {
    // Проверяем токен перед отправкой
    if (this.authService.isTokenExpired()) {
      this.sessionExpired = true;
      this.generalError = 'Сессия истекла. Пожалуйста, войдите снова.';
      return;
    }

    // Сброс ошибок и успеха
    this.clearErrors();
    this.success = false;

    // Валидация паролей
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
        
        if (error.status === 401) {
          this.sessionExpired = true;
          this.generalError = 'Сессия истекла. Пожалуйста, войдите снова.';
        } else if (error.status === 400) {
          if (error.error?.message === 'Неверный старый пароль') {
            this.oldPasswordIncorrect = true;
          } else {
            this.generalError = error.error?.message || 'Ошибка при смене пароля';
          }
        } else {
          this.generalError = 'Произошла ошибка при смене пароля. Проверьте введенные данные и попробуйте еще раз.';
        }
      }
    });
  }

  // Метод для очистки ошибок при вводе
  clearErrors() {
    this.fieldsEmpty = false;
    this.passwordMismatch = false;
    this.passwordTooShort = false;
    this.sameAsOld = false;
    this.oldPasswordIncorrect = false;
    this.generalError = '';
  }
}