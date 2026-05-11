import { BadRequestException, ValidationPipe, ValidationPipeOptions } from '@nestjs/common';

export function buildValidationPipe(opts: ValidationPipeOptions = {}): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: (errors) => {
      const flat = errors.flatMap((e) =>
        Object.values(e.constraints ?? {}).map((m) => `${e.property}: ${m}`),
      );
      return new BadRequestException({ statusCode: 400, message: flat });
    },
    ...opts,
  });
}
