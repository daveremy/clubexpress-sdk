import { ClubExpressClient } from '../src/core/client';
import { AuthModule } from '../src/modules/auth/auth.module';
import { CourtsModule } from '../src/modules/courts/courts.module';
import { ClubExpressError } from '../src/core/error';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get credentials from environment variables
const CLUB_ID = process.env.CLUB_ID || '';
const BASE_URL = process.env.BASE_URL || 'https://spa.clubexpress.com';
const USERNAME = process.env.USERNAME || '';
const PASSWORD = process.env.PASSWORD || '';

/**
 * Test the courts module
 */
async function testCourts() {
  console.log('=== ClubExpress SDK Courts Test ===');
  console.log(`Club ID: ${CLUB_ID}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Username: ${USERNAME}`);
  console.log(`Password: ${'*'.repeat(PASSWORD.length)}`);
  console.log('\n');

  // Create client with debug enabled
  const client = new ClubExpressClient(CLUB_ID, BASE_URL, true);
  const auth = new AuthModule(client);
  const courts = new CourtsModule(client);

  try {
    // Step 1: Login (required for court operations)
    console.log('--- Step 1: Login ---');
    try {
      const loginSuccess = await auth.login(USERNAME, PASSWORD, true);
      if (loginSuccess) {
        console.log('✅ Login successful');
      } else {
        console.log('❌ Login failed');
        return;
      }
    } catch (error) {
      console.log(`❌ Login failed: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    // Step 2: Find all courts
    console.log('\n--- Step 2: Find All Courts ---');
    try {
      const allCourts = await courts.findAllCourts();
      if (allCourts.length > 0) {
        console.log(`✅ Found ${allCourts.length} courts:`);
        allCourts.forEach((court, index) => {
          console.log(`  ${index + 1}. ${court.name} (ID: ${court.id})`);
        });
      } else {
        console.log('⚠️ No courts found');
      }
    } catch (error) {
      console.log(`❌ Failed to find courts: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Step 3: Find available courts for today
    console.log('\n--- Step 3: Find Available Courts (Today) ---');
    try {
      const today = new Date();
      const formattedDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
      
      console.log(`Checking availability for date: ${formattedDate}`);
      
      const availableCourts = await courts.findAvailableCourts({
        date: formattedDate
      });
      
      if (availableCourts.length > 0) {
        console.log(`✅ Found ${availableCourts.length} courts with availability:`);
        
        availableCourts.forEach((courtAvailability, courtIndex) => {
          console.log(`  ${courtIndex + 1}. ${courtAvailability.court.name} (ID: ${courtAvailability.court.id}):`);
          console.log(`     Available slots: ${courtAvailability.availableSlots.length}`);
          
          // Display first 3 slots as examples
          const slotsToShow = courtAvailability.availableSlots.slice(0, 3);
          slotsToShow.forEach((slot, slotIndex) => {
            const startTime = new Date(slot.startTime).toLocaleTimeString();
            const endTime = new Date(slot.endTime).toLocaleTimeString();
            console.log(`     ${slotIndex + 1}. ${startTime} - ${endTime} (${slot.durationMinutes} minutes)`);
          });
          
          if (courtAvailability.availableSlots.length > 3) {
            console.log(`     ... and ${courtAvailability.availableSlots.length - 3} more slots`);
          }
        });
      } else {
        console.log('⚠️ No courts available for today');
      }
    } catch (error) {
      console.log(`❌ Failed to find available courts: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Step 4: Find available courts for tomorrow with filters
    console.log('\n--- Step 4: Find Available Courts (Tomorrow with Filters) ---');
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const formattedTomorrow = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
      
      // Set morning hours (8 AM to 12 PM)
      const morningStart = new Date(tomorrow);
      morningStart.setHours(8, 0, 0, 0);
      
      const morningEnd = new Date(tomorrow);
      morningEnd.setHours(12, 0, 0, 0);
      
      console.log(`Checking availability for date: ${formattedTomorrow} (Morning hours)`);
      
      const availableCourts = await courts.findAvailableCourts({
        date: formattedTomorrow,
        startTime: morningStart.toISOString(),
        endTime: morningEnd.toISOString(),
        minDurationMinutes: 60
      });
      
      if (availableCourts.length > 0) {
        console.log(`✅ Found ${availableCourts.length} courts with morning availability:`);
        
        availableCourts.forEach((courtAvailability, courtIndex) => {
          console.log(`  ${courtIndex + 1}. ${courtAvailability.court.name} (ID: ${courtAvailability.court.id}):`);
          console.log(`     Available slots: ${courtAvailability.availableSlots.length}`);
          
          // Display first 3 slots as examples
          const slotsToShow = courtAvailability.availableSlots.slice(0, 3);
          slotsToShow.forEach((slot, slotIndex) => {
            const startTime = new Date(slot.startTime).toLocaleTimeString();
            const endTime = new Date(slot.endTime).toLocaleTimeString();
            console.log(`     ${slotIndex + 1}. ${startTime} - ${endTime} (${slot.durationMinutes} minutes)`);
          });
          
          if (courtAvailability.availableSlots.length > 3) {
            console.log(`     ... and ${courtAvailability.availableSlots.length - 3} more slots`);
          }
        });
      } else {
        console.log('⚠️ No courts available for tomorrow morning');
      }
    } catch (error) {
      console.log(`❌ Failed to find available courts for tomorrow: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Step 5: Logout
    console.log('\n--- Step 5: Logout ---');
    try {
      const logoutSuccess = await auth.logout();
      if (logoutSuccess) {
        console.log('✅ Logout successful');
      } else {
        console.log('❌ Logout failed');
      }
    } catch (error) {
      console.log(`❌ Logout failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  } catch (error) {
    console.error('Test failed with error:', error);
  }

  console.log('\n=== Courts Test Completed ===');
}

// Run the test
testCourts().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 