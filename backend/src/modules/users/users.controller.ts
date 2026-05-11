import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthPrincipal, CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentUniversity } from '../../common/decorators/university.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { UsersService } from './users.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCodes } from '../../common/errors/error-codes';
import { UserRole } from '@prisma/client';

class CreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsIn(['admin', 'student', 'doctor'])
  role!: UserRole;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiBearerAuth()
@ApiTags('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('users')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users (admin only).' })
  list(
    @CurrentUniversity() uni: string,
    @Query() q: PaginationQueryDto,
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.svc.list(uni, q.page ?? 1, q.pageSize ?? 25, { search, role });
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user (admin only).' })
  create(
    @CurrentUniversity() uni: string,
    @CurrentUser() actor: AuthPrincipal,
    @Body() dto: CreateUserDto,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.svc.create(uni, actor.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user (admin only).' })
  update(
    @CurrentUniversity() uni: string,
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.svc.update(uni, actor.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a user (admin only).' })
  async remove(
    @CurrentUniversity() uni: string,
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    await this.svc.remove(uni, actor.userId, id);
    return { success: true };
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a new temporary password for a user (admin only).' })
  resetPassword(
    @CurrentUniversity() uni: string,
    @CurrentUser() actor: AuthPrincipal,
    @Param('id') id: string,
  ) {
    if (!uni) throw new AppException(ErrorCodes.UNAUTHORIZED);
    return this.svc.resetPassword(uni, actor.userId, id);
  }
}
