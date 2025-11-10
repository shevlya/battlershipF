import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-win-page',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './win-page.component.html',
  styleUrl: './win-page.component.scss'
})
export class WinPageComponent implements OnInit {

  constructor(private router: Router) {}

  ngOnInit() {
    this.playWinAnimation();
  }

  goToLobby() {
    console.log('Возврат в лобби');
    this.router.navigate(['/lobby']);
  }

  playWinAnimation() {
    console.log('Запуск анимации победы!');
  }
}