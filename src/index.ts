import dotenv from 'dotenv';
import { ClubExpressClient } from './core/client';
import { AuthModule } from './modules/auth/auth.module';

// Load environment variables
dotenv.config();

// Export main classes and types
export { ClubExpressClient } from './core/client';
export { AuthModule } from './modules/auth/auth.module';

// Export types
export * from './core/types';
export * from './modules/auth/types';

// Create default client instance
const defaultClient = new ClubExpressClient({
  clubId: process.env.CLUB_ID,
  debug: process.env.DEBUG === 'true',
});

// Export default instance with modules
export default {
  client: defaultClient,
  auth: new AuthModule(defaultClient),
}; 