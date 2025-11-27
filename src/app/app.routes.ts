import { Routes } from '@angular/router';
import { LoginPageComponent } from './pages/login-page/login-page.component';
import { RegisterPageComponent } from './pages/register-page/register-page.component';
import { HomePageComponent } from './pages/home-page/home-page.component';
import { InfoPageComponent } from './pages/info-page/info-page.component';
import { LobbyPageComponent } from './pages/lobby-page/lobby-page.component';
import { MultiplayerPageComponent } from './pages/multiplayer-page/multiplayer-page.component';
import { WaitingPageComponent } from './pages/waiting-page/waiting-page.component';
import { AcceptGameComponent } from './pages/accept-game-page/accept-game-page.component';
import { WinPageComponent } from './pages/win-page/win-page.component';
import { LosePageComponent } from './pages/lose-page/lose-page.component';
import { AiGamePageComponent } from './pages/ai-game-page/ai-game-page.component';
import { ProfilePageComponent } from './pages/profile-page/profile-page.component';
import { ChangeAvatarPageComponent } from './pages/change-avatar-page/change-avatar-page.component';
import { ChangePasswordPageComponent } from './pages/change-password-page/change-password-page.component';
import { PlacementUserPageComponent } from './pages/placement-user-page/placement-user-page.component';

export const routes: Routes = [
  { path: '', component: HomePageComponent }, // Главная страница
  { path: 'login', component: LoginPageComponent },
  { path: 'register', component: RegisterPageComponent },
  { path: 'info', component: InfoPageComponent },
  { path: 'lobby', component: LobbyPageComponent },
  { path: 'multiplayer', component: MultiplayerPageComponent },
  { path: 'waiting', component: WaitingPageComponent },
  { path: 'accept-game', component: AcceptGameComponent },
  { path: 'win', component: WinPageComponent},
  { path: 'lose', component: LosePageComponent },
  { path: 'ai-game', component: AiGamePageComponent},
  { path: 'profile', component: ProfilePageComponent}, 
  {path: 'change-avatar', component: ChangeAvatarPageComponent},
  { path: 'change-password', component: ChangePasswordPageComponent},
  { path: 'placement', component: PlacementUserPageComponent},
  { path: '**', redirectTo: '' }
];