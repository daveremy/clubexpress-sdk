import dotenv from 'dotenv';
import { ClubExpressClient } from './core/client';
import { AuthModule } from './modules/auth/auth.module';
import { CourtsModule } from './modules/courts/courts.module';

// Load environment variables
dotenv.config();

// Export main classes and types
export { ClubExpressClient } from './core/client';
export { AuthModule } from './modules/auth/auth.module';
export { CourtsModule } from './modules/courts/courts.module';

// Export types
export * from './core/types';
export * from './modules/auth/types';
export * from './modules/courts/types';

// Create default client instance
const defaultClient = new ClubExpressClient(
  process.env.CLUB_ID || '',
  process.env.BASE_URL || 'https://spa.clubexpress.com',
  process.env.DEBUG === 'true'
);

// Export default instance with modules
export default {
  client: defaultClient,
  auth: new AuthModule(defaultClient),
  courts: new CourtsModule(defaultClient),
}; 