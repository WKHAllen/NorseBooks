// Export all services
export * from './services/admin';
export * from './services/auth';
export * from './services/book';
export * from './services/condition';
export * from './services/department';
export * from './services/feedback';
export * from './services/loginRegister';
export * from './services/meta';
export * from './services/misc';
export * from './services/passwordReset';
export * from './services/platform';
export * from './services/report';
export * from './services/searchSort';
export * from './services/session';
export * from './services/stats';
export * from './services/user';
export * from './services/verification';

// Initialize the database on import
import { init } from './services/util';
init();
