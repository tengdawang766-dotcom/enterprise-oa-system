import bcrypt from 'bcryptjs';
import { prisma } from '../../infrastructure/database/prisma';
import { BusinessException } from '../../common/exception/business-exception';
import { ErrorCode } from '../../common/exception/error-code';
import { generateToken, JwtPayload } from '../../common/auth/authentication';
import { LoginRequest } from './dto/auth.dto';

export class AuthService {
  async login(dto: LoginRequest) {
    const user = await prisma.user.findUnique({
      where: { username: dto.username },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        name: true,
        role: true,
        status: true,
        mustChangePassword: true,
        tokenVersion: true,
        departmentId: true,
      },
    });

    if (!user) {
      throw BusinessException.unauthorized(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        '账号或密码错误'
      );
    }

    if (user.status === 'DISABLED') {
      throw BusinessException.unauthorized(
        ErrorCode.ACCOUNT_DISABLED,
        '账号已停用'
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw BusinessException.unauthorized(
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        '账号或密码错误'
      );
    }

    const payload: JwtPayload = {
      userId: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    const token = generateToken(payload);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        departmentId: user.departmentId,
      },
    };
  }

  async getCurrentUser(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        status: true,
        mustChangePassword: true,
        departmentId: true,
        jobTitle: true,
        workEmail: true,
        phone: true,
        department: {
          select: {
            id: true,
            name: true,
            managerUserId: true,
          },
        },
      },
    });

    if (!user) {
      throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '用户不存在');
    }

    if (user.status === 'DISABLED') {
      throw BusinessException.unauthorized(ErrorCode.ACCOUNT_DISABLED, '账号已停用');
    }

    const isDepartmentManager = user.department?.managerUserId === user.id;

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      departmentId: user.departmentId,
      departmentName: user.department?.name || null,
      jobTitle: user.jobTitle,
      workEmail: user.workEmail,
      phone: user.phone,
      isDepartmentManager,
    };
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, tokenVersion: true },
    });

    if (!user) {
      throw BusinessException.notFound(ErrorCode.RESOURCE_NOT_FOUND, '用户不存在');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw BusinessException.badRequest(
        ErrorCode.VALIDATION_ERROR,
        '当前密码错误'
      );
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
    });

    return { message: '密码修改成功，请重新登录' };
  }
}

export const authService = new AuthService();
