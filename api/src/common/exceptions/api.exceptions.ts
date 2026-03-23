import { HttpException, HttpStatus } from '@nestjs/common';

export class NotFoundApiException extends HttpException {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super({ statusCode: HttpStatus.NOT_FOUND, error: 'Not Found', message }, HttpStatus.NOT_FOUND);
  }
}

export class ValidationApiException extends HttpException {
  constructor(message: string) {
    super(
      { statusCode: HttpStatus.BAD_REQUEST, error: 'Validation Error', message },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class AuthenticationApiException extends HttpException {
  constructor(message = 'Authentication failed') {
    super(
      { statusCode: HttpStatus.UNAUTHORIZED, error: 'Unauthorized', message },
      HttpStatus.UNAUTHORIZED,
    );
  }
}

export class AuthorizationApiException extends HttpException {
  constructor(message = 'Access denied') {
    super(
      { statusCode: HttpStatus.FORBIDDEN, error: 'Forbidden', message },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class DatabaseApiException extends HttpException {
  constructor(message = 'Database error') {
    super(
      { statusCode: HttpStatus.SERVICE_UNAVAILABLE, error: 'Service Unavailable', message },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class RateLimitApiException extends HttpException {
  constructor(message = 'Too many requests') {
    super(
      { statusCode: HttpStatus.TOO_MANY_REQUESTS, error: 'Too Many Requests', message },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
