import { Module } from '@nestjs/common';
import { PasswordResetModule } from '../password-reset/password-reset.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PasswordResetModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
