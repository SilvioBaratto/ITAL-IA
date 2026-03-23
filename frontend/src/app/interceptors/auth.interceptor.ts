import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { from, switchMap, catchError, throwError } from 'rxjs';

let refreshPromise: Promise<boolean> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = authService.getAccessToken();
  const authedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authedReq).pipe(
    catchError((error) => {
      if (error.status === 401) {
        return from(handleTokenRefresh(authService)).pipe(
          switchMap((refreshed) => {
            if (refreshed) {
              const newToken = authService.getAccessToken();
              const retryReq = newToken
                ? req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })
                : req;
              return next(retryReq);
            }
            return from(authService.logout()).pipe(
              switchMap(() => {
                router.navigate(['/login'], { replaceUrl: true });
                return throwError(() => error);
              }),
            );
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};

function handleTokenRefresh(authService: AuthService): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = authService.refreshSession().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}
