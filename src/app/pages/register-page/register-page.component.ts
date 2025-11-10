import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [FormsModule, RouterModule], // Добавьте необходимые импорты
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss'
})
export class RegisterPageComponent {
  username = '';
  password = '';
  confirmPassword = '';

  onSubmit() {
    // Добавьте логику регистрации здесь
    console.log('Регистрация:', {
      username: this.username,
      password: this.password,
      confirmPassword: this.confirmPassword
    });

    // Пример валидации
    if (this.password !== this.confirmPassword) {
      alert('Пароли не совпадают!');
      return;
    }

    // Здесь будет вызов сервиса для регистрации
    // this.authService.register(this.username, this.password).subscribe(...)
  }
}