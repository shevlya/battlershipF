import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * Компонент страницы регистрации нового пользователя
 * 
 * Основные функции:
 * - Создание новой учетной записи пользователя
 * - Валидация вводимых данных на клиентской стороне
 * - Проверка корректности логина и пароля
 * - Автоматический вход после успешной регистрации
 * - Обработка ошибок регистрации
 * 
 * @component
 * @selector app-register-page
 * 
 * Особенности валидации:
 * - Проверка формата логина (регулярное выражение)
 * - Минимальная длина логина (3 символа)
 * - Минимальная длина пароля (6 символов)
 * - Подтверждение пароля для избежания опечаток
 * - Валидация в реальном времени при вводе
 */
@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss'
})
export class RegisterPageComponent {
  /**
   * Логин пользователя для регистрации
   * Должен соответствовать формату: начинаться с буквы, может содержать буквы, цифры, ., _, -
   */
  username = '';

  /**
   * Пароль пользователя
   * Минимальная длина - 6 символов
   */
  password = '';

  /**
   * Подтверждение пароля
   * Должен точно совпадать с полем password
   */
  confirmPassword = '';

  /**
   * Флаг общей ошибки регистрации
   * Устанавливается true при ошибках на сервере (логин занят и т.д.)
   */
  registerError = false;

  /**
   * Флаг несовпадения пароля и подтверждения
   */
  passwordMismatch = false;

  /**
   * Флаг недостаточной длины пароля (менее 6 символов)
   */
  passwordTooShort = false;

  /**
   * Флаг невалидного формата логина
   * Логин должен соответствовать регулярному выражению
   */
  invalidUsername = false;

  /**
   * Флаг недостаточной длины логина (менее 3 символов)
   */
  usernameTooShort = false;

  /**
   * Флаг незаполненных обязательных полей
   */
  fieldsEmpty = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  /**
   * Метод валидации логина пользователя
   * 
   * Правила валидации логина:
   * - Должен начинаться с буквы (латинский алфавит)
   * - Может содержать: буквы, цифры, точку, подчеркивание, дефис
   * - Минимальная длина: 3 символа
   * 
   * Регулярное выражение: /^[a-zA-Z][a-zA-Z0-9._-]*$/
   * - ^[a-zA-Z] - начинается с буквы
   * - [a-zA-Z0-9._-]* - продолжается буквами, цифрами, ., _, -
   */
  validateUsername() {
    const usernameRegex = /^[a-zA-Z][a-zA-Z0-9._-]*$/;
    this.invalidUsername = this.username.length > 0 && !usernameRegex.test(this.username);
    
    this.usernameTooShort = this.username.length > 0 && this.username.length < 3;
  }

  /**
   * Обработчик ввода в поле логина
   * Сбрасывает соответствующие ошибки и выполняет валидацию
   * 
   * Использование:
   * - Привязывается к событию input поля логина
   * - Обеспечивает мгновенную обратную связь пользователю
   */
  onUsernameInput() {
    this.registerError = false;
    this.invalidUsername = false;
    this.usernameTooShort = false;
    this.fieldsEmpty = false;
    this.validateUsername();
  }

  /**
   * Обработчик ввода в поле пароля
   * Сбрасывает ошибки связанные с паролем
   */
  onPasswordInput() {
    this.registerError = false;
    this.passwordTooShort = false;
    this.passwordMismatch = false;
    this.fieldsEmpty = false;
  }

  /**
   * Обработчик ввода в поле подтверждения пароля
   * Сбрасывает ошибки связанные с подтверждением пароля
   */
  onConfirmPasswordInput() {
    this.registerError = false;
    this.passwordMismatch = false;
    this.fieldsEmpty = false;
  }

  /**
   * Основной метод обработки отправки формы регистрации
   * 
   * Процесс регистрации:
   * 1. Сброс всех предыдущих ошибок
   * 2. Валидация заполнения обязательных полей
   * 3. Валидация формата и длины логина
   * 4. Валидация длины пароля
   * 5. Проверка совпадения пароля и подтверждения
   * 6. Отправка запроса на сервер через AuthService
   * 7. Обработка успешного ответа (вход и перенаправление в лобби)
   * 8. Обработка ошибок регистрации
   * 
   * @throws {Error} При проблемах с сетью или сервером
   */
  onSubmit() {
    // Полный сброс состояния ошибок перед новой попыткой
    this.registerError = false;
    this.passwordMismatch = false;
    this.passwordTooShort = false;
    this.invalidUsername = false;
    this.usernameTooShort = false;
    this.fieldsEmpty = false;

    // ==================== ВАЛИДАЦИЯ ОБЯЗАТЕЛЬНЫХ ПОЛЕЙ ====================

    // Проверка что все обязательные поля заполнены
    if (!this.username.trim() || !this.password || !this.confirmPassword) {
      this.fieldsEmpty = true;
      console.error('Все поля обязательны');
      return;
    }

    // ==================== ВАЛИДАЦИЯ ЛОГИНА ====================

    // Проверка формата логина с помощью регулярного выражения
    this.validateUsername();
    if (this.invalidUsername) {
      console.error('Логин содержит запрещенные символы');
      return;
    }

    // Проверка минимальной длины логина
    if (this.username.length < 3) {
      this.usernameTooShort = true;
      console.error('Логин должен быть не менее 3 символов');
      return;
    }

    // ==================== ВАЛИДАЦИЯ ПАРОЛЯ ====================

    // Проверка минимальной длины пароля
    if (this.password.length < 6) {
      this.passwordTooShort = true;
      console.error('Пароль должен быть не менее 6 символов');
      return;
    }

    // Проверка совпадения пароля и подтверждения
    if (this.password !== this.confirmPassword) {
      this.passwordMismatch = true;
      console.error('Пароли не совпадают');
      return;
    }

    // ==================== ОТПРАВКА ЗАПРОСА РЕГИСТРАЦИИ ====================

    /**
     * Вызов сервиса регистрации
     * При успешной регистрации автоматически выполняется вход в систему
     */
    this.authService.register(this.username, this.password).subscribe({
      next: (response) => {
        console.log('Успешная регистрация:', response);
        
        // Сохранение токена и данных пользователя для автоматического входа
        this.authService.setTokenAndUser(response.token, response);
        this.registerError = false;
        
        // Перенаправление на лобби
        this.router.navigate(['/lobby']);
      },
      error: (err) => {
        console.error('Ошибка регистрации:', err);
        this.registerError = true;
      }
    });
  }
}