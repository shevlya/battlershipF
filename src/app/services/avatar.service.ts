import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AvatarService {
  private readonly API_URL = `${environment.apiUrl}/api/players`;

  constructor(private http: HttpClient) {}

  getAvailableAvatars(): Observable<string[]> {
    return this.http.get<string[]>(`${this.API_URL}/avatars`);
  }
}