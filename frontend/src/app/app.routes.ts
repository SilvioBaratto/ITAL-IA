import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login').then((m) => m.LoginComponent),
    canActivate: [guestGuard],
    title: 'Login',
  },
  {
    path: 'auth/forgot-password',
    loadComponent: () => import('./auth/forgot-password/forgot-password').then((m) => m.ForgotPasswordComponent),
    canActivate: [guestGuard],
    title: 'Forgot Password',
  },
  {
    path: 'auth/update-password',
    loadComponent: () => import('./auth/update-password/update-password').then((m) => m.UpdatePasswordComponent),
    title: 'Update Password',
  },
  {
    path: '',
    loadComponent: () => import('./shared/layout/layout').then((m) => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/chatbot/chatbot').then((m) => m.ChatbotComponent),
        title: 'Chatbot',
      },
      {
        path: 'saved',
        loadComponent: () => import('./pages/saved/saved').then((m) => m.SavedPageComponent),
        title: 'Salvati',
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile').then((m) => m.ProfilePageComponent),
        title: 'Profilo',
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFoundComponent),
    title: '404 — Pagina non trovata',
  },
];
