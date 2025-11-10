import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, RouterModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss'
})
export class LoginPageComponent {
  username = '';
  password = '';

  constructor(private router: Router) {}

  onSubmit() {
    // Здесь будет вызов сервиса для авторизации
    console.log('Авторизация:', {
      username: this.username,
      password: this.password
    });

    // После успешной авторизации перенаправляем в лобби
    // this.authService.login(this.username, this.password).subscribe(
    //   success => {
    //     if (success) {
          this.router.navigate(['/lobby']);
    //     }
    //   }
    // );
  }
}