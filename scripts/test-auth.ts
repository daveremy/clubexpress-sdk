import { ClubExpressClient } from '../src/core/client';
import { AuthModule } from '../src/modules/auth/auth.module';
import { ClubExpressError } from '../src/core/error';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get credentials from environment variables
const CLUB_ID = process.env.CLUB_ID || '886618';
const BASE_URL = process.env.BASE_URL || 'https://spa.clubexpress.com';
const USERNAME = process.env.USERNAME || 'dremy';
const PASSWORD = process.env.PASSWORD || '22Pickleme22';

/**
 * Test the authentication module
 */
async function testAuth() {
  console.log('=== ClubExpress SDK Authentication Test ===');
  console.log(`Club ID: ${CLUB_ID}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Username: ${USERNAME}`);
  console.log(`Password: ${'*'.repeat(PASSWORD.length)}`);
  console.log('\n');

  // Create client with debug enabled
  const client = new ClubExpressClient(CLUB_ID, BASE_URL, true);
  const auth = new AuthModule(client);

  try {
    // Step 1: Test site access
    console.log('--- Step 1: Testing Site Access ---');
    const mainPageUrl = `/content.aspx?page_id=1300&club_id=${CLUB_ID}`;
    const response = await client.get(mainPageUrl);
    
    if (response.status === 200) {
      console.log(`✅ Successfully accessed main page: Status ${response.status}`);
    } else {
      console.log(`❌ Failed to access main page: Status ${response.status}`);
      return;
    }

    // Step 2: Test login
    console.log('\n--- Step 2: Login Test ---');
    try {
      const loginSuccess = await auth.login(USERNAME, PASSWORD, true);
      if (loginSuccess) {
        console.log('✅ Login successful');
        
        // Test session validation
        console.log('\n--- Step 3: Session Validation ---');
        const isLoggedIn = await auth.isLoggedIn();
        if (isLoggedIn) {
          console.log('✅ Session validation successful');
        } else {
          console.log('❌ Session validation failed');
        }
        
        // Test logout
        console.log('\n--- Step 4: Logout Test ---');
        const logoutSuccess = await auth.logout();
        if (logoutSuccess) {
          console.log('✅ Logout successful');
        } else {
          console.log('❌ Logout failed');
        }
      } else {
        console.log('❌ Login failed');
      }
    } catch (error) {
      if (error instanceof ClubExpressError) {
        console.log(`❌ Authentication test failed: ${error.message}`);
        if (error.stack) {
          console.log(error.stack);
        }
      } else {
        console.log(`❌ Authentication test failed with unexpected error: ${error}`);
      }
    }
  } catch (error) {
    console.error('Test failed with error:', error);
  }

  console.log('\n=== Authentication Test Completed ===');
}

// Run the test
testAuth().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 