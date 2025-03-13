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
 * Test the court booking functionality
 */
async function testCourtBooking() {
  console.log('=== ClubExpress SDK Court Booking Test ===');
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

    // Step 2: Find available courts for tomorrow
    console.log('\n--- Step 2: Find Available Courts (Tomorrow) ---');
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
        
        // Save the first available court and slot for booking
        const firstCourt = availableCourts[0];
        const firstSlot = firstCourt.availableSlots[0];
        
        // Step 3: Book a court
        console.log('\n--- Step 3: Book a Court ---');
        try {
          console.log(`Attempting to book ${firstCourt.court.name} for ${new Date(firstSlot.startTime).toLocaleTimeString()} - ${new Date(firstSlot.endTime).toLocaleTimeString()}`);
          
          const booking = await courts.bookCourt({
            courtId: firstCourt.court.id,
            date: formattedTomorrow,
            startTime: firstSlot.startTime,
            endTime: firstSlot.endTime,
            purpose: 'SDK Test Booking',
          });
          
          console.log('✅ Court booked successfully:');
          console.log(`  Booking ID: ${booking.id}`);
          console.log(`  Court: ${booking.court.name}`);
          console.log(`  Date: ${new Date(booking.date).toLocaleDateString()}`);
          console.log(`  Time: ${new Date(booking.startTime).toLocaleTimeString()} - ${new Date(booking.endTime).toLocaleTimeString()}`);
          console.log(`  Status: ${booking.status}`);
          
          // Step 4: Get my bookings
          console.log('\n--- Step 4: Get My Bookings ---');
          try {
            const myBookings = await courts.getMyBookings();
            
            if (myBookings.length > 0) {
              console.log(`✅ Found ${myBookings.length} bookings:`);
              
              myBookings.forEach((booking, index) => {
                console.log(`  ${index + 1}. ${booking.court.name} on ${new Date(booking.date).toLocaleDateString()} at ${new Date(booking.startTime).toLocaleTimeString()} - ${new Date(booking.endTime).toLocaleTimeString()}`);
                console.log(`     Status: ${booking.status}`);
              });
              
              // Step 5: Cancel the booking
              console.log('\n--- Step 5: Cancel the Booking ---');
              try {
                // Find the booking we just created
                const ourBooking = myBookings.find(b => 
                  b.court.id === firstCourt.court.id && 
                  new Date(b.startTime).getTime() === new Date(firstSlot.startTime).getTime()
                );
                
                if (ourBooking) {
                  console.log(`Cancelling booking for ${ourBooking.court.name} on ${new Date(ourBooking.date).toLocaleDateString()}`);
                  
                  const cancellationSuccess = await courts.cancelBooking({
                    bookingId: ourBooking.id,
                    reason: 'SDK Test Cancellation',
                  });
                  
                  if (cancellationSuccess) {
                    console.log('✅ Booking cancelled successfully');
                  } else {
                    console.log('❌ Failed to cancel booking');
                  }
                } else {
                  console.log('⚠️ Could not find our booking to cancel');
                }
              } catch (error) {
                console.log(`❌ Failed to cancel booking: ${error instanceof Error ? error.message : String(error)}`);
              }
            } else {
              console.log('⚠️ No bookings found');
            }
          } catch (error) {
            console.log(`❌ Failed to get bookings: ${error instanceof Error ? error.message : String(error)}`);
          }
        } catch (error) {
          console.log(`❌ Failed to book court: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        console.log('⚠️ No courts available for tomorrow morning');
      }
    } catch (error) {
      console.log(`❌ Failed to find available courts for tomorrow: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Step 6: Logout
    console.log('\n--- Step 6: Logout ---');
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

  console.log('\n=== Court Booking Test Completed ===');
}

// Run the test
testCourtBooking().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 