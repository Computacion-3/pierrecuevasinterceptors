import * as crypto from 'crypto';

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

import { AppLogger } from '../logger/logger.service';

@Injectable()
export class TraceabilityInterceptor implements NestInterceptor {
    constructor(private readonly logger: AppLogger) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const httpContext = context.switchToHttp();
        const request = httpContext.getRequest<Request>();
        const response = httpContext.getResponse<Response>();

        // 1. Captura o Generación de ID (soporta string o array de headers)
        const headerCorrelationId = request.headers['x-correlation-id'];
        const correlationId =
            (Array.isArray(headerCorrelationId) ? headerCorrelationId[0] : headerCorrelationId) || crypto.randomUUID();

        // 2. Inyección en el Contexto de Request y Response Headers
        request.correlationId = correlationId;
        response.setHeader('x-correlation-id', correlationId);

        const startTime = Date.now();
        const { method, originalUrl } = request;

        // 3. Medición de Latencia y Logging de Salida
        return next.handle().pipe(
            tap(() => {
                const duration = Date.now() - startTime;
                const statusCode = response.statusCode;

                // Formato exacto: [TRACE] [GET /api/users] [200 OK] [Duration: 42ms] [CorrelationID: f47ac10b-58cc-4372-a567-0e02b2c3d479]
                const traceLog = `[TRACE] [${method} ${originalUrl}] [${statusCode} OK] [Duration: ${duration}ms] [CorrelationID: ${correlationId}]`;

                // Registrar usando el método con soporte de traza de AppLogger
                this.logger.logWithTrace(correlationId, 'LOG', traceLog);
            }),
        );
    }
}
