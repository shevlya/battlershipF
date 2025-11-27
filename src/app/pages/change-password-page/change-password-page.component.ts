import { Component, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

/**
 * Компонент страницы смены пароля пользователя
 * 
 * Основные функции:
 * - Безопасная смена пароля авторизованного пользователя
 * - Валидация вводимых данных на клиентской и серверной стороне
 * - Проверка срока действия токена авторизации
 * - Обработка различных сценариев ошибок
 * - Автоматическое перенаправление после успешной смены
 * 
 * @component
 * @selector app-change-password-page
 * 
 * Особенности безопасности:
 * - Проверка срока действия JWT токена
 * - Валидация сложности нового пароля
 * - Подтверждение нового пароля
 * - Защита от использования старого пароля
 */
@Component({
  selector: 'app-change-password-page',
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule],
  templateUrl: './change-password-page.component.html',
  styleUrl: './change-password-page.component.scss'
})
export class ChangePasswordPageComponent implements OnInit {
  /**
   * Объект с данными для смены пароля
   * Содержит три поля: старый пароль, новый пароль и подтверждение
   */
  passwordData = {
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  /** Флаг выполнения операции смены пароля */
  isLoading = false;

  /** Флаг успешного завершения смены пароля */
  success = false;

  /** Флаг истечения срока действия сессии */
  sessionExpired = false;

  // ==================== ВАЛИДАЦИОННЫЕ ОШИБКИ ====================

  /** Ошибка: не все поля заполнены */
  fieldsEmpty = false;

  /** Ошибка: новый пароль и подтверждение не совпадают */
  passwordMismatch = false;

  /** Ошибка: новый пароль слишком короткий (менее 6 символов) */
  passwordTooShort = false;

  /** Ошибка: новый пароль совпадает со старым */
  sameAsOld = false;

  /** Ошибка: старый пароль введен неверно */
  oldPasswordIncorrect = false;

  /** Общее сообщение об ошибке для серверных ошибок */
  generalError = '';

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  /**
   * Метод инициализации компонента
   * Выполняет проверку валидности токена при загрузке страницы
   */
  ngOnInit() {
    this.checkToken();
  }

  /**
   * Проверка срока действия JWT токена авторизации
   * 
   * Использование:
   * - Вызывается при инициализации компонента
   * - Предотвращает отправку запросов с просроченным токеном
   * - Устанавливает флаг sessionExpired при необходимости
   */
  checkToken() {
    if (this.authService.isTokenExpired()) {
      this.sessionExpired = true;
      console.log('Токен просрочен, требуется перелогин');
    } else {
      console.log('Токен валиден');
    }
  }

  /**
   * Основной метод смены пароля пользователя
   * 
   * Процесс смены пароля:
   * 1. Проверка валидности токена
   * 2. Клиентская валидация данных
   * 3. Отправка запроса на сервер через AuthService
   * 4. Обработка успешного ответа
   * 5. Обработка различных типов ошибок
   * 
   * Валидационные проверки:
   * - Заполненность всех полей
   * - Минимальная длина нового пароля (6 символов)
   * - Совпадение нового пароля и подтверждения
   * - Отличие нового пароля от старого
   */
  changePassword() {
    // Проверяем токен перед отправкой запроса
    if (this.authService.isTokenExpired()) {
      this.sessionExpired = true;
      this.generalError = 'Сессия истекла. Пожалуйста, войдите снова.';
      return;
    }

    // Сброс предыдущих состояний ошибок и успеха
    this.clearErrors();
    this.success = false;

    // ==================== КЛИЕНТСКАЯ ВАЛИДАЦИЯ ====================

    // Проверка заполненности всех обязательных полей
    if (!this.passwordData.oldPassword || !this.passwordData.newPassword || !this.passwordData.confirmPassword) {
      this.fieldsEmpty = true;
      return;
    }

    // Проверка минимальной длины нового пароля
    if (this.passwordData.newPassword.length < 6) {
      this.passwordTooShort = true;
      return;
    }

    // Проверка совпадения нового пароля и подтверждения
    if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
      this.passwordMismatch = true;
      return;
    }

    // Проверка что новый пароль отличается от старого
    if (this.passwordData.oldPassword === this.passwordData.newPassword) {
      this.sameAsOld = true;
      return;
    }

    // ==================== ОТПРАВКА ЗАПРОСА ====================

    this.isLoading = true;

    /**
     * Вызов сервиса для смены пароля через API
     * Использует HTTP запрос с JWT токеном в заголовках
     */
    this.authService.changePassword(this.passwordData.oldPassword, this.passwordData.newPassword).subscribe({
      next: (response) => {
        console.log('Пароль успешно изменен:', response);
        this.isLoading = false;
        this.success = true;
        
        // Очистка формы после успешной смены пароля
        this.passwordData = {
          oldPassword: '',
          newPassword: '',
          confirmPassword: ''
        };

        /**
         * Автоматическое перенаправление на страницу профиля
         * Пользователь видит сообщение об успехе 2 секунды перед переходом
         */
        setTimeout(() => {
          this.router.navigate(['/profile']);
        }, 2000);
      },
      error: (error) => {
        console.error('Ошибка при смене пароля:', error);
        this.isLoading = false;
        
        // ==================== ОБРАБОТКА РАЗЛИЧНЫХ ОШИБОК ====================
        
        if (error.status === 401) {
          // Неавторизованный доступ - токен просрочен или невалиден
          this.sessionExpired = true;
          this.generalError = 'Сессия истекла. Пожалуйста, войдите снова.';
        } else if (error.status === 400) {
          // Ошибка валидации на сервере
          if (error.error?.message === 'Неверный старый пароль') {
            this.oldPasswordIncorrect = true;
          } else {
            // Другие ошибки валидации с сервера
            this.generalError = error.error?.message || 'Ошибка при смене пароля';
          }
        } else {
          // Общие серверные ошибки (500, сетевые проблемы и т.д.)
          this.generalError = 'Произошла ошибка при смене пароля. Проверьте введенные данные и попробуйте еще раз.';
        }
      }
    });
  }

  /**
   * Метод для очистки всех ошибок валидации
   * 
   * Использование:
   * - Вызывается перед каждой попыткой смены пароля
   * - Обеспечивает чистые поля для новой валидации
   * - Не показываем старые ошибки
   */
  clearErrors() {
    this.fieldsEmpty = false;
    this.passwordMismatch = false;
    this.passwordTooShort = false;
    this.sameAsOld = false;
    this.oldPasswordIncorrect = false;
    this.generalError = '';
  }
}