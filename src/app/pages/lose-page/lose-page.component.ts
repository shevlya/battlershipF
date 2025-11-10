import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-lose-page',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './lose-page.component.html',
  styleUrl: './lose-page.component.scss'
})
export class LosePageComponent implements OnInit {

  constructor(private router: Router) {}

  ngOnInit() {
    this.playLoseAnimation();
  }

  goToLobby() {
    console.log('Возврат в лобби после проигрыша');
    this.router.navigate(['/lobby']);
  }

  playLoseAnimation() {
    console.log('Запуск анимации проигрыша');
  }
}