// Firebase replaced by Authelia + PostgreSQL + SSE.
// This stub keeps TypeScript happy until all import sites are updated.
export const auth: any = null;
export const db: any = null;
export const signIn = async (): Promise<never> => { throw new Error('Firebase removed'); };
export const logOut = async (): Promise<never> => { throw new Error('Firebase removed'); };
export const handleFirestoreError = (error: unknown): never => { throw error as Error; };
export enum OperationType { CREATE = 'create', UPDATE = 'update', DELETE = 'delete', LIST = 'list', GET = 'get', WRITE = 'write' }
export const googleProvider: any = null;
