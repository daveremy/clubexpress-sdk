import { ClubExpressClient } from '../src/core/client';
import { AuthModule } from '../src/modules/auth/auth.module';
import { CourtsModule } from '../src/modules/courts/courts.module';
import { CourtAvailability, CourtBooking } from '../src/modules/courts/types';
import * as dotenv from 'dotenv';
import * as readline from 'readline';
import chalk from 'chalk';

// Load environment variables
dotenv.config();

// Get credentials from environment variables
const CLUB_ID = process.env.CLUB_ID || '';
const BASE_URL = process.env.BASE_URL || 'https://spa.clubexpress.com';
const USERNAME = process.env.USERNAME || '';
const PASSWORD = process.env.PASSWORD || '';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Debug mode flag
let debugMode = false;

// Create client and modules
const client = new ClubExpressClient(CLUB_ID, BASE_URL, debugMode);
const auth = new AuthModule(client);
const courts = new CourtsModule(client);

// Global state
let isLoggedIn = false;
let availableCourts: CourtAvailability[] = [];
let myBookings: CourtBooking[] = [];

/**
 * Ask a question and get user input
 */
function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * Display the main menu and handle user selection
 */
async function showMainMenu() {
  console.log('\n' + chalk.bold.blue('=== ClubExpress Courts CLI ==='));
  console.log(chalk.cyan('1.') + ' Login');
  console.log(chalk.cyan('2.') + ' Find Available Courts');
  console.log(chalk.cyan('3.') + ' Book a Court');
  console.log(chalk.cyan('4.') + ' View My Bookings');
  console.log(chalk.cyan('5.') + ' Cancel a Booking');
  console.log(chalk.cyan('6.') + ' View Full Day Grid');
  console.log(chalk.cyan('7.') + ' Logout');
  console.log(chalk.cyan('8.') + ' Toggle Debug Mode');
  console.log(chalk.cyan('9.') + ' Exit');
  
  const choice = await askQuestion('\nEnter your choice (1-9): ');
  
  switch (choice) {
    case '1':
      await handleLogin();
      break;
    case '2':
      await handleFindAvailableCourts();
      break;
    case '3':
      await handleBookCourt();
      break;
    case '4':
      await handleViewBookings();
      break;
    case '5':
      await handleCancelBooking();
      break;
    case '6':
      await handleViewFullDayGrid();
      break;
    case '7':
      await handleLogout();
      break;
    case '8':
      await handleToggleDebugMode();
      break;
    case '9':
      await handleExit();
      break;
    default:
      console.log(chalk.red('Invalid choice. Please try again.'));
      await showMainMenu();
  }
}

/**
 * Handle toggling debug mode
 */
async function handleToggleDebugMode() {
  debugMode = !debugMode;
  client.setDebugMode(debugMode);
  
  if (debugMode) {
    console.log(chalk.green('Debug mode enabled. You will see detailed debug information.'));
  } else {
    console.log(chalk.yellow('Debug mode disabled. Debug information will be hidden.'));
  }
  
  await showMainMenu();
}

/**
 * Handle login
 */
async function handleLogin() {
  if (isLoggedIn) {
    console.log(chalk.yellow('You are already logged in.'));
    await showMainMenu();
    return;
  }
  
  console.log('\n' + chalk.bold.blue('--- Login ---'));
  
  // Use environment variables or ask for credentials
  let username = USERNAME;
  let password = PASSWORD;
  
  if (!username) {
    username = await askQuestion('Enter your username: ');
  }
  
  if (!password) {
    password = await askQuestion('Enter your password: ');
  }
  
  try {
    console.log('Logging in...');
    const loginSuccess = await auth.login(username, password, true);
    
    if (loginSuccess) {
      console.log(chalk.green('✅ Login successful'));
      isLoggedIn = true;
    } else {
      console.log(chalk.red('❌ Login failed'));
    }
  } catch (error) {
    console.log(chalk.red(`❌ Login failed: ${error instanceof Error ? error.message : String(error)}`));
  }
  
  await showMainMenu();
}

/**
 * Validate a date against the club's reservation rules
 * @param date The date to validate
 * @returns An object with isValid and message properties
 */
function validateReservationDate(date: Date): { isValid: boolean; message: string } {
  const now = new Date();
  
  // Check if date is in the past
  if (date < now && date.toDateString() !== now.toDateString()) {
    return { isValid: false, message: 'Cannot make reservations for dates in the past.' };
  }
  
  // Calculate the maximum allowed booking date (7 days from now)
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 7);
  
  // Check if date is more than 7 days in the future
  if (date > maxDate) {
    return { 
      isValid: false, 
      message: `Reservations can only be made up to 7 days in advance (until ${maxDate.toLocaleDateString()}).` 
    };
  }
  
  // Check if it's too early to book for the max date
  if (date.toDateString() === maxDate.toDateString()) {
    const bookingOpenTime = new Date(maxDate);
    bookingOpenTime.setHours(13, 0, 0, 0); // 1:00 PM
    
    if (now < bookingOpenTime) {
      return { 
        isValid: false, 
        message: `Reservations for ${maxDate.toLocaleDateString()} open at 1:00 PM today.` 
      };
    }
  }
  
  return { isValid: true, message: '' };
}

/**
 * Parse a date string in various formats
 * @param dateInput The date string to parse
 * @returns A Date object or null if invalid
 */
function parseDate(dateInput: string): Date | null {
  // Handle "today" and "tomorrow"
  if (dateInput.toLowerCase() === 'today') {
    return new Date();
  } else if (dateInput.toLowerCase() === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  
  // Try MM/DD/YYYY format
  if (dateInput.includes('/')) {
    const parts = dateInput.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0]) - 1; // JS months are 0-indexed
      const day = parseInt(parts[1]);
      let year = parseInt(parts[2]);
      
      // Handle 2-digit years
      if (year < 100) {
        year += 2000;
      }
      
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }
  
  // Try YYYY-MM-DD format
  const isoDate = new Date(dateInput);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  
  return null;
}

/**
 * Handle finding available courts
 */
async function handleFindAvailableCourts() {
  if (!isLoggedIn) {
    console.log(chalk.yellow('You must be logged in to find available courts.'));
    await showMainMenu();
    return;
  }
  
  console.log('\n' + chalk.bold.blue('--- Find Available Courts ---'));
  
  // Ask for date
  const dateInput = await askQuestion('Enter date (MM/DD/YYYY or YYYY-MM-DD) or "today" or "tomorrow": ');
  
  const date = parseDate(dateInput);
  if (!date) {
    console.log(chalk.red('Invalid date format. Please use MM/DD/YYYY or YYYY-MM-DD.'));
    await showMainMenu();
    return;
  }
  
  // Validate date against club rules
  const validation = validateReservationDate(date);
  if (!validation.isValid) {
    console.log(chalk.red(validation.message));
    await showMainMenu();
    return;
  }
  
  const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
  console.log(`Using date: ${chalk.cyan(formattedDate)} (${date.toLocaleDateString()})`);
  
  // Ask for time range
  const startTimeInput = await askQuestion('Enter start time (HH:MM) or leave empty for all day: ');
  const endTimeInput = await askQuestion('Enter end time (HH:MM) or leave empty for all day: ');
  
  let startTime: Date | undefined;
  let endTime: Date | undefined;
  
  if (startTimeInput) {
    const [hours, minutes] = startTimeInput.split(':').map(Number);
    startTime = new Date(date);
    startTime.setHours(hours, minutes, 0, 0);
    console.log(`Using start time: ${chalk.cyan(startTime.toLocaleTimeString())} (MST)`);
  }
  
  if (endTimeInput) {
    const [hours, minutes] = endTimeInput.split(':').map(Number);
    endTime = new Date(date);
    endTime.setHours(hours, minutes, 0, 0);
    console.log(`Using end time: ${chalk.cyan(endTime.toLocaleTimeString())} (MST)`);
  }
  
  try {
    console.log(`Checking availability for ${chalk.cyan(formattedDate)}...`);
    console.log('Using direct API call to retrieve court availability data.');
    console.log(chalk.yellow('Note: All times are displayed in Mountain Standard Time (MST).'));
    console.log(chalk.yellow('Each booking slot is 90 minutes (8:00 AM - 9:30 AM, 9:30 AM - 11:00 AM, etc.).'));
    
    const options: any = { date: formattedDate };
    
    if (startTime) {
      options.startTime = startTime.toISOString();
    }
    
    if (endTime) {
      options.endTime = endTime.toISOString();
    }
    
    console.log('Searching for available courts with options:', JSON.stringify(options, null, 2));
    availableCourts = await courts.findAvailableCourts(options);
    
    if (availableCourts.length > 0) {
      console.log(`\n${chalk.green('✅ Found')} ${chalk.bold(availableCourts.length.toString())} courts with availability:`);
      
      availableCourts.forEach((courtAvailability, courtIndex) => {
        console.log(`\n${chalk.cyan(`${courtIndex + 1}.`)} ${chalk.bold(courtAvailability.court.name)} (ID: ${courtAvailability.court.id}):`);
        console.log(`   Available slots: ${chalk.yellow(courtAvailability.availableSlots.length.toString())}`);
        
        courtAvailability.availableSlots.forEach((slot, slotIndex) => {
          // Format times for display in MST
          const startTimeObj = new Date(slot.startTime);
          const endTimeObj = new Date(slot.endTime);
          
          // Format as HH:MM AM/PM
          const formatTime = (date: Date) => {
            const hours = date.getHours();
            const minutes = date.getMinutes();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const hour12 = hours % 12 || 12;
            return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
          };
          
          const startTimeStr = formatTime(startTimeObj);
          const endTimeStr = formatTime(endTimeObj);
          
          // Check if this is a full 90-minute block
          const durationMinutes = (endTimeObj.getTime() - startTimeObj.getTime()) / (1000 * 60);
          const isFullBlock = durationMinutes === 90 && startTimeObj.getMinutes() % 30 === 0;
          
          const timeDisplay = `${startTimeStr} - ${endTimeStr}`;
          if (isFullBlock) {
            console.log(`   ${chalk.cyan(`${slotIndex + 1}.`)} ${chalk.green(timeDisplay)} MST (${slot.durationMinutes} minutes)`);
          } else {
            console.log(`   ${chalk.cyan(`${slotIndex + 1}.`)} ${chalk.yellow(timeDisplay)} MST (${slot.durationMinutes} minutes) - ${chalk.red('Not a full 90-minute block')}`);
          }
        });
      });
      
      console.log('\n' + chalk.yellow('Tip: Use option 6 from the main menu to view the full day grid.'));
      console.log('\n' + chalk.yellow('Club Reservation Rules:'));
      console.log('1. A member may reserve only one court per day for play and must be present.');
      console.log('2. Reservations can be made up to seven days in advance, opening at 1:00 PM.');
      console.log('3. Reservations are made in 1.5-hour blocks starting at 8:00 AM.');
      console.log('4. Only book full time blocks. Skip partial blocks and book the next full block.');
    } else {
      console.log(chalk.yellow('No courts available for the selected date and time.'));
      console.log('Note: This could be because:');
      console.log('1. All courts are booked for this date');
      console.log('2. The date you selected is outside the booking window (max 7 days in advance)');
      console.log('3. There are no courts available that match your time criteria');
      console.log('\nThe SDK is now using the direct API that ClubExpress uses internally,');
      console.log('so the availability information should be accurate.');
      console.log('\n' + chalk.yellow('Tip: Use option 6 from the main menu to view the full day grid.'));
    }
  } catch (error) {
    console.log(chalk.red(`❌ Failed to find available courts: ${error instanceof Error ? error.message : String(error)}`));
    
    // Provide more helpful error messages based on common issues
    if (error instanceof Error && error.message.includes('404')) {
      console.log(chalk.yellow('\nPossible reasons for this error:'));
      console.log('1. The date is too far in the future (max 7 days in advance)');
      console.log('2. The date format was not recognized by the server');
      console.log('3. The ClubExpress API endpoint may have changed');
    }
  }
  
  await showMainMenu();
}

/**
 * Handle booking a court
 */
async function handleBookCourt() {
  if (!isLoggedIn) {
    console.log(chalk.yellow('You must be logged in to book a court.'));
    await showMainMenu();
    return;
  }
  
  if (availableCourts.length === 0) {
    console.log(chalk.yellow('No available courts found. Please find available courts first.'));
    await showMainMenu();
    return;
  }
  
  console.log('\n' + chalk.bold.blue('--- Book a Court ---'));
  
  // Display club reservation rules
  console.log(chalk.yellow('\nClub Reservation Rules:'));
  console.log('1. A member may reserve only one court per day for play and must be present.');
  console.log('2. Reservations can be made up to seven days in advance, opening at 1:00 PM.');
  console.log('3. Reservations are made in 1.5-hour blocks starting at 8:00 AM.');
  console.log('4. Only book full time blocks. Skip partial blocks and book the next full block.\n');
  
  // Display available courts
  console.log(chalk.bold('Available courts:'));
  availableCourts.forEach((courtAvailability, courtIndex) => {
    console.log(`${chalk.cyan(`${courtIndex + 1}.`)} ${chalk.bold(courtAvailability.court.name)} (ID: ${courtAvailability.court.id})`);
  });
  
  // Ask for court selection
  const courtIndexInput = await askQuestion('Enter court number to book: ');
  const courtIndex = parseInt(courtIndexInput) - 1;
  
  if (isNaN(courtIndex) || courtIndex < 0 || courtIndex >= availableCourts.length) {
    console.log(chalk.red('Invalid court selection.'));
    await showMainMenu();
    return;
  }
  
  const selectedCourt = availableCourts[courtIndex];
  
  // Display available time slots
  console.log(`\n${chalk.bold(`Available time slots for ${selectedCourt.court.name}:`)}`);
  
  // Filter to only show full 90-minute blocks
  const fullTimeSlots = selectedCourt.availableSlots.filter(slot => {
    const startTime = new Date(slot.startTime);
    const endTime = new Date(slot.endTime);
    const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
    const isFullBlock = durationMinutes === 90 && startTime.getMinutes() % 30 === 0;
    return isFullBlock;
  });
  
  if (fullTimeSlots.length === 0) {
    console.log(chalk.yellow('No full 1.5-hour blocks available for this court.'));
    console.log('According to club rules, you should only book full 1.5-hour blocks.');
    await showMainMenu();
    return;
  }
  
  fullTimeSlots.forEach((slot, slotIndex) => {
    const startTime = new Date(slot.startTime);
    const endTime = new Date(slot.endTime);
    
    // Format as HH:MM AM/PM
    const formatTime = (date: Date) => {
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 || 12;
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    };
    
    const startTimeStr = formatTime(startTime);
    const endTimeStr = formatTime(endTime);
    
    console.log(`${chalk.cyan(`${slotIndex + 1}.`)} ${chalk.green(`${startTimeStr} - ${endTimeStr}`)} MST (${slot.durationMinutes} minutes)`);
  });
  
  // Ask for time slot selection
  const slotIndexInput = await askQuestion('Enter time slot number to book: ');
  const slotIndex = parseInt(slotIndexInput) - 1;
  
  if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= fullTimeSlots.length) {
    console.log(chalk.red('Invalid time slot selection.'));
    await showMainMenu();
    return;
  }
  
  const selectedSlot = fullTimeSlots[slotIndex];
  
  // Check if the user already has a booking for this date
  try {
    const bookingDate = new Date(selectedCourt.date);
    const formattedDate = bookingDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const existingBookings = await courts.getMyBookings(formattedDate, formattedDate);
    if (existingBookings.length > 0) {
      console.log(chalk.red('You already have a booking for this date.'));
      console.log('According to club rules, a member may reserve only one court per day.');
      
      console.log('\nYour existing booking:');
      const booking = existingBookings[0];
      console.log(`Court: ${chalk.bold(booking.court.name)}`);
      console.log(`Date: ${chalk.cyan(new Date(booking.date).toLocaleDateString())}`);
      console.log(`Time: ${chalk.cyan(`${new Date(booking.startTime).toLocaleTimeString()} - ${new Date(booking.endTime).toLocaleTimeString()}`)}`);
      
      await showMainMenu();
      return;
    }
  } catch (error) {
    console.log(chalk.yellow('Could not check existing bookings. Proceeding with caution.'));
  }
  
  // Ask for booking details
  const purpose = await askQuestion('Enter purpose (optional): ');
  const participants = await askQuestion('Enter participants separated by commas (optional): ');
  
  // Confirm booking
  console.log('\n' + chalk.bold('Booking Summary:'));
  console.log(`Court: ${chalk.bold(selectedCourt.court.name)}`);
  console.log(`Date: ${chalk.cyan(new Date(selectedCourt.date).toLocaleDateString())}`);
  console.log(`Time: ${chalk.cyan(`${new Date(selectedSlot.startTime).toLocaleTimeString()} - ${new Date(selectedSlot.endTime).toLocaleTimeString()}`)}`);
  if (purpose) console.log(`Purpose: ${purpose}`);
  if (participants) console.log(`Participants: ${participants}`);
  
  const confirmBooking = await askQuestion('\nConfirm booking? (y/n): ');
  if (confirmBooking.toLowerCase() !== 'y') {
    console.log(chalk.yellow('Booking cancelled.'));
    await showMainMenu();
    return;
  }
  
  try {
    console.log('Booking court...');
    
    const bookingOptions = {
      courtId: selectedCourt.court.id,
      date: selectedCourt.date,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
      purpose: purpose || undefined,
      participants: participants ? participants.split(',').map(p => p.trim()) : undefined
    };
    
    const booking = await courts.bookCourt(bookingOptions);
    
    console.log('\n' + chalk.green('✅ Court booked successfully:'));
    console.log(`Court: ${chalk.bold(booking.court.name)}`);
    console.log(`Date: ${chalk.cyan(new Date(booking.date).toLocaleDateString())}`);
    console.log(`Time: ${chalk.cyan(`${new Date(booking.startTime).toLocaleTimeString()} - ${new Date(booking.endTime).toLocaleTimeString()}`)}`);
    console.log(`Status: ${chalk.green(booking.status)}`);
    console.log(`Booking ID: ${chalk.yellow(booking.id)}`);
    
    // Refresh available courts
    const options = { date: selectedCourt.date };
    availableCourts = await courts.findAvailableCourts(options);
  } catch (error) {
    console.log(chalk.red(`❌ Failed to book court: ${error instanceof Error ? error.message : String(error)}`));
    
    // Provide more helpful error messages based on common issues
    if (error instanceof Error) {
      if (error.message.includes('COURTS_BOOKING_RULE_VIOLATION')) {
        console.log(chalk.yellow('\nThis error occurred because the booking violates club rules:'));
        console.log('1. A member may reserve only one court per day for play and must be present.');
        console.log('2. Reservations can be made up to seven days in advance, opening at 1:00 PM.');
        console.log('3. Reservations are made in 1.5-hour blocks starting at 8:00 AM.');
        console.log('4. Only book full time blocks. Skip partial blocks and book the next full block.');
      }
    }
  }
  
  await showMainMenu();
}

/**
 * Handle viewing bookings
 */
async function handleViewBookings() {
  if (!isLoggedIn) {
    console.log(chalk.yellow('You must be logged in to view bookings.'));
    await showMainMenu();
    return;
  }
  
  console.log('\n' + chalk.bold.blue('--- My Bookings ---'));
  
  try {
    console.log('Retrieving bookings...');
    
    myBookings = await courts.getMyBookings();
    
    if (myBookings.length > 0) {
      console.log(`\n${chalk.green('✅ Found')} ${chalk.bold(myBookings.length.toString())} bookings:`);
      
      myBookings.forEach((booking, index) => {
        console.log(`\n${chalk.cyan(`${index + 1}.`)} Booking ID: ${chalk.yellow(booking.id)}`);
        console.log(`   Court: ${chalk.bold(booking.court.name)}`);
        console.log(`   Date: ${chalk.cyan(new Date(booking.date).toLocaleDateString())}`);
        console.log(`   Time: ${chalk.cyan(`${new Date(booking.startTime).toLocaleTimeString()} - ${new Date(booking.endTime).toLocaleTimeString()}`)}`);
        console.log(`   Status: ${chalk.green(booking.status)}`);
        if (booking.purpose) {
          console.log(`   Purpose: ${booking.purpose}`);
        }
        if (booking.participants && booking.participants.length > 0) {
          console.log(`   Participants: ${booking.participants.join(', ')}`);
        }
      });
    } else {
      console.log(chalk.yellow('No bookings found.'));
    }
  } catch (error) {
    console.log(chalk.red(`❌ Failed to retrieve bookings: ${error instanceof Error ? error.message : String(error)}`));
  }
  
  await showMainMenu();
}

/**
 * Handle canceling a booking
 */
async function handleCancelBooking() {
  if (!isLoggedIn) {
    console.log(chalk.yellow('You must be logged in to cancel a booking.'));
    await showMainMenu();
    return;
  }
  
  console.log('\n' + chalk.bold.blue('--- Cancel Booking ---'));
  
  // Check if we have bookings loaded
  if (myBookings.length === 0) {
    try {
      console.log('Retrieving bookings...');
      myBookings = await courts.getMyBookings();
    } catch (error) {
      console.log(chalk.red(`❌ Failed to retrieve bookings: ${error instanceof Error ? error.message : String(error)}`));
      await showMainMenu();
      return;
    }
  }
  
  if (myBookings.length === 0) {
    console.log(chalk.yellow('No bookings found to cancel.'));
    await showMainMenu();
    return;
  }
  
  // Display bookings
  console.log(chalk.bold('Your bookings:'));
  myBookings.forEach((booking, index) => {
    console.log(`${chalk.cyan(`${index + 1}.`)} ${chalk.bold(booking.court.name)} on ${chalk.cyan(new Date(booking.date).toLocaleDateString())} at ${chalk.cyan(`${new Date(booking.startTime).toLocaleTimeString()} - ${new Date(booking.endTime).toLocaleTimeString()}`)}`);
  });
  
  // Ask for booking selection
  const bookingIndexInput = await askQuestion('Enter booking number to cancel: ');
  const bookingIndex = parseInt(bookingIndexInput) - 1;
  
  if (isNaN(bookingIndex) || bookingIndex < 0 || bookingIndex >= myBookings.length) {
    console.log(chalk.red('Invalid booking selection.'));
    await showMainMenu();
    return;
  }
  
  const selectedBooking = myBookings[bookingIndex];
  
  // Ask for cancellation reason
  const reason = await askQuestion('Enter cancellation reason (optional): ');
  
  try {
    console.log('Cancelling booking...');
    
    const cancellationSuccess = await courts.cancelBooking({
      bookingId: selectedBooking.id,
      reason: reason || undefined
    });
    
    if (cancellationSuccess) {
      console.log(chalk.green('✅ Booking cancelled successfully'));
      
      // Remove the cancelled booking from the list
      myBookings = myBookings.filter((_, index) => index !== bookingIndex);
    } else {
      console.log(chalk.red('❌ Failed to cancel booking'));
    }
  } catch (error) {
    console.log(chalk.red(`❌ Failed to cancel booking: ${error instanceof Error ? error.message : String(error)}`));
  }
  
  await showMainMenu();
}

/**
 * Handle viewing the full day grid
 */
async function handleViewFullDayGrid() {
  if (!isLoggedIn) {
    console.log(chalk.yellow('You must be logged in to view the full day grid.'));
    await showMainMenu();
    return;
  }
  
  console.log('\n' + chalk.bold.blue('--- View Full Day Grid ---'));
  
  // Ask for date
  const dateInput = await askQuestion('Enter date (MM/DD/YYYY or YYYY-MM-DD) or "today" or "tomorrow": ');
  
  const date = parseDate(dateInput);
  if (!date) {
    console.log(chalk.red('Invalid date format. Please use MM/DD/YYYY or YYYY-MM-DD.'));
    await showMainMenu();
    return;
  }
  
  // Validate date against club rules
  const validation = validateReservationDate(date);
  if (!validation.isValid) {
    console.log(chalk.red(validation.message));
    await showMainMenu();
    return;
  }
  
  const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
  console.log(`Using date: ${chalk.cyan(formattedDate)} (${date.toLocaleDateString()})`);
  
  try {
    console.log(`Loading full day grid for ${chalk.cyan(formattedDate)}...`);
    
    // First, fetch the available courts to populate the grid data
    console.log('Fetching court data...');
    await courts.findAvailableCourts({ date: formattedDate });
    
    // Get the grid data
    const gridData = courts.getLastGridData();
    
    if (!gridData) {
      console.log(chalk.red('No grid data available. Please try again.'));
      await showMainMenu();
      return;
    }
    
    // Display the grid header
    console.log(`\n${chalk.bold(`Court Availability for ${chalk.cyan(gridData.displayDate)}`)}`);
    console.log(chalk.yellow('All times are in Mountain Standard Time (MST)'));
    console.log(chalk.yellow('Each booking slot is 90 minutes\n'));
    
    // Define the time slots
    const timeSlots = [
      '8:00 AM - 9:30 AM',
      '9:30 AM - 11:00 AM',
      '11:00 AM - 12:30 PM',
      '12:30 PM - 2:00 PM',
      '2:00 PM - 3:30 PM',
      '3:30 PM - 5:00 PM',
      '5:00 PM - 6:30 PM'
    ];
    
    // Calculate column width based on court names
    const timeColumnWidth = 20;
    const courtColumnWidth = 22;
    
    // Create a compact grid display
    // First, create groups of courts to display in rows
    const courtsPerRow = 5; // Display 5 courts per row
    const courtGroups = [];
    
    for (let i = 0; i < gridData.resources.length; i += courtsPerRow) {
      courtGroups.push(gridData.resources.slice(i, i + courtsPerRow));
    }
    
    // For each group of courts
    courtGroups.forEach((courtGroup, groupIndex) => {
      if (groupIndex > 0) {
        console.log('\n'); // Add space between court groups
      }
      
      // Print the header row with court names
      let headerRow = chalk.bold(chalk.cyan('TIME SLOT'.padEnd(timeColumnWidth)));
      
      courtGroup.forEach((resource: any) => {
        headerRow += chalk.bold(chalk.cyan(' | ' + resource.name.padEnd(courtColumnWidth - 3)));
      });
      
      console.log(headerRow);
      
      // Print a separator line
      const separatorLine = '─'.repeat(timeColumnWidth + (courtColumnWidth * courtGroup.length));
      console.log(chalk.gray(separatorLine));
      
      // For each time slot, show the availability for each court in this group
      timeSlots.forEach((timeSlot, index) => {
        let row = chalk.bold(timeSlot.padEnd(timeColumnWidth));
        
        // Calculate the time slot IDs for this time slot
        const startSlotId = gridData.firstTS + index * 6;
        const endSlotId = startSlotId + 5;
        
        courtGroup.forEach((resource: any) => {
          // Check if there's a reservation for this time slot
          const reservation = resource.reservations.find((r: any) => 
            (r.firstTS <= startSlotId && r.lastTS >= startSlotId) || 
            (r.firstTS <= endSlotId && r.lastTS >= endSlotId) ||
            (r.firstTS >= startSlotId && r.lastTS <= endSlotId)
          );
          
          if (reservation) {
            // Show both user name and usage description
            let reservationText = '';
            
            // Add usage description if available
            if (reservation.usageDescription && reservation.usageDescription.trim() !== '') {
              reservationText += reservation.usageDescription.trim();
            }
            
            // Add user name if available and different from usage description
            if (reservation.userName && 
                reservation.userName.trim() !== '' && 
                reservation.userName.trim() !== reservation.usageDescription.trim()) {
              if (reservationText) {
                reservationText += ' / ';
              }
              reservationText += reservation.userName.trim();
            }
            
            // Truncate if too long
            if (reservationText.length > courtColumnWidth - 4) {
              reservationText = reservationText.substring(0, courtColumnWidth - 7) + '...';
            }
            
            // Color based on reservation type
            let coloredText;
            if (reservation.userName.includes('Drop-In') || reservation.usageDescription.includes('OPEN')) {
              coloredText = chalk.green(reservationText.padEnd(courtColumnWidth - 3));
            } else if (reservation.userName.includes('Organized Play')) {
              coloredText = chalk.magenta(reservationText.padEnd(courtColumnWidth - 3));
            } else {
              coloredText = chalk.yellow(reservationText.padEnd(courtColumnWidth - 3));
            }
            
            row += ' | ' + coloredText;
          } else {
            // Check if this time slot is within the available range for this court
            if (startSlotId >= resource.firstAvailableTS && endSlotId <= resource.lastAvailableTS) {
              row += ' | ' + chalk.bgGreen.black(' AVAILABLE '.padEnd(courtColumnWidth - 3));
            } else {
              row += ' | ' + chalk.gray(' CLOSED '.padEnd(courtColumnWidth - 3));
            }
          }
        });
        
        console.log(row);
        console.log(chalk.gray(separatorLine));
      });
    });
    
    // Display a legend
    console.log('\n' + chalk.bold('Legend:'));
    console.log(chalk.bgGreen.black(' AVAILABLE ') + ' - Court is available for booking');
    console.log(chalk.gray(' CLOSED ') + ' - Court is closed during this time');
    console.log(chalk.green('Green text') + ' - Drop-in or open play');
    console.log(chalk.magenta('Purple text') + ' - Organized play');
    console.log(chalk.yellow('Yellow text') + ' - Individual booking');
    
  } catch (error) {
    console.log(chalk.red(`❌ Failed to fetch grid data: ${error instanceof Error ? error.message : String(error)}`));
  }
  
  await showMainMenu();
}

/**
 * Handle logout
 */
async function handleLogout() {
  if (!isLoggedIn) {
    console.log(chalk.yellow('You are not logged in.'));
    await showMainMenu();
    return;
  }
  
  console.log('\n' + chalk.bold.blue('--- Logout ---'));
  
  try {
    console.log('Logging out...');
    const logoutSuccess = await auth.logout();
    
    if (logoutSuccess) {
      console.log(chalk.green('✅ Logout successful'));
      isLoggedIn = false;
      availableCourts = [];
      myBookings = [];
    } else {
      console.log(chalk.red('❌ Logout failed'));
    }
  } catch (error) {
    console.log(chalk.red(`❌ Logout failed: ${error instanceof Error ? error.message : String(error)}`));
  }
  
  await showMainMenu();
}

/**
 * Handle exit
 */
async function handleExit() {
  if (isLoggedIn) {
    console.log('Logging out before exit...');
    try {
      await auth.logout();
    } catch (error) {
      console.log(chalk.yellow(`Warning: Logout failed: ${error instanceof Error ? error.message : String(error)}`));
    }
  }
  
  console.log(chalk.green('Goodbye!'));
  rl.close();
  process.exit(0);
}

/**
 * Main function
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  if (args.includes('--debug')) {
    debugMode = true;
    client.setDebugMode(true);
    console.log(chalk.green('Debug mode enabled via command line argument.'));
  }
  
  console.log(chalk.bold.blue('=== ClubExpress Courts CLI ==='));
  console.log(`Club ID: ${chalk.cyan(CLUB_ID)}`);
  console.log(`Base URL: ${chalk.cyan(BASE_URL)}`);
  console.log(`Username: ${USERNAME ? chalk.cyan(USERNAME) : chalk.gray('[Not set in .env]')}`);
  console.log(`Password: ${PASSWORD ? chalk.cyan('*'.repeat(PASSWORD.length)) : chalk.gray('[Not set in .env]')}`);
  console.log(`Debug Mode: ${debugMode ? chalk.green('Enabled') : chalk.yellow('Disabled')}`);
  console.log('\nThis CLI allows you to interactively find, book, and cancel courts.');
  console.log(chalk.gray('Tip: Run with --debug flag to enable debug mode from the start.'));
  
  await showMainMenu();
}

// Start the CLI
main().catch(error => {
  console.error(chalk.red('Unhandled error:'), error);
  rl.close();
  process.exit(1);
}); 