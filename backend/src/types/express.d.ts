import 'express';

declare global {
  namespace Express {
    interface Request {
      universityId?: string;
      auth?: {
        userId: string;
        role: 'admin' | 'student' | 'doctor';
        universityId: string;
      };
    }
  }
}

export {};
