import { ClubExpressClient } from '../../core/client';
import { ClubExpressError } from '../../core/error';
import * as cheerio from 'cheerio';
import { 
  Court, 
  CourtAvailability, 
  CourtFilterOptions, 
  AvailabilityOptions, 
  TimeSlot,
  BookingOptions,
  CourtBooking,
  CancelBookingOptions
} from './types';

/**
 * Courts module for ClubExpress
 * Handles court discovery, availability checking, and booking
 */
export class CourtsModule {
  constructor(private client: ClubExpressClient) {}

  /**
   * Find all courts in the club
   * @param options Optional filtering options
   * @returns Array of courts
   */
  async findAllCourts(options?: CourtFilterOptions): Promise<Court[]> {
    this.client.debug('Finding all courts...');
    
    // Check if user is authenticated
    if (!this.client.getAuthStatus()) {
      throw new ClubExpressError('COURTS_NOT_AUTHENTICATED', 'User must be authenticated to find courts');
    }
    
    try {
      // Access the court reservation page - using the URL from the screenshot
      const reservationPageUrl = `/content.aspx?page_id=1301&club_id=${this.client.getClubId()}`;
      const response = await this.client.get(reservationPageUrl);
      
      // Parse the HTML response
      const $ = this.client.parseHtml(response.data);
      
      // Extract courts from the page
      const courts: Court[] = [];
      
      // Based on the screenshot, courts are displayed as columns in a table
      // Each court has a header with "Court X" where X is the court number
      $('table tr:first-child th').each((index, element) => {
        const $element = $(element);
        const headerText = $element.text().trim();
        
        // Skip the first column which is likely the time column
        if (index === 0 || !headerText) {
          return;
        }
        
        // Extract court name and ID from the header
        const courtMatch = headerText.match(/Court\s+(\d+)/i);
        if (courtMatch) {
          const courtId = courtMatch[1];
          const courtName = headerText.trim();
          
          const court: Court = {
            id: courtId,
            name: courtName,
            // We'll add more properties as we discover them
          };
          
          courts.push(court);
        }
      });
      
      this.client.debug(`Found ${courts.length} courts`);
      
      // Apply filters if provided
      let filteredCourts = [...courts];
      
      if (options) {
        if (options.type) {
          filteredCourts = filteredCourts.filter(court => 
            court.type && court.type.toLowerCase().includes(options.type!.toLowerCase())
          );
        }
        
        if (options.features && options.features.length > 0) {
          filteredCourts = filteredCourts.filter(court => 
            court.features && Array.isArray(court.features) && options.features!.every(feature => 
              court.features!.some(f => f.toLowerCase().includes(feature.toLowerCase()))
            )
          );
        }
        
        if (options.location) {
          filteredCourts = filteredCourts.filter(court => 
            court.location && court.location.toLowerCase().includes(options.location!.toLowerCase())
          );
        }
      }
      
      return filteredCourts;
    } catch (error) {
      if (error instanceof ClubExpressError) {
        throw error;
      }
      
      throw new ClubExpressError(
        'COURTS_DISCOVERY_FAILED',
        `Failed to find courts: ${(error as Error).message}`
      );
    }
  }

  /**
   * Find available courts based on date and time
   * @param options Availability options including date and time range
   * @returns Array of court availability information
   */
  async findAvailableCourts(options: AvailabilityOptions): Promise<CourtAvailability[]> {
    this.client.debug(`Finding available courts for date: ${options.date}`);
    
    // Check if user is authenticated
    if (!this.client.getAuthStatus()) {
      throw new ClubExpressError(
        'COURTS_NOT_AUTHENTICATED',
        'User must be authenticated to find available courts'
      );
    }

    // Validate required options
    if (!options.date) {
      throw new ClubExpressError(
        'COURTS_INVALID_OPTIONS',
        'Date is required to find available courts'
      );
    }

    try {
      // Calculate date offset from today
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day
      
      const targetDate = new Date(options.date);
      targetDate.setHours(0, 0, 0, 0); // Reset time to start of day
      
      // Calculate days difference
      const diffTime = targetDate.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      this.client.debug(`Date offset from today: ${diffDays} days`);
      
      // Construct the API URL
      const categoryId = '1196'; // This seems to be fixed for courts
      const timestamp = Date.now(); // Cache-busting timestamp
      const url = `/handlers/res_sched.ashx?type=g&cat=${categoryId}&d=${diffDays}&_=${timestamp}`;
      
      this.client.debug(`Calling reservation API with URL: ${url}`);
      
      // Make the API request
      const response = await this.client.get(url);
      
      // Parse the JSON response
      const gridData = response.data;
      this.client.debug(`Received grid data for date: ${gridData.currentDate}, display date: ${gridData.displayDate}`);
      
      // Store the raw grid data for potential display in the CLI
      this.lastGridData = gridData;
      
      // Map of time slot IDs to actual times
      // Based on the screenshot and user feedback, courts open at 8:00 AM and close at 5:30 PM
      // Time slots are in 15-minute increments, with 6 slots (90 minutes) per booking
      const timeSlotMap: Record<number, string> = {};
      
      // Define the fixed time slots based on the screenshot
      // The time slots appear to be:
      // 8:00 AM - 9:30 AM (firstTS to firstTS+5)
      // 9:30 AM - 11:00 AM
      // 11:00 AM - 12:30 PM
      // 12:30 PM - 2:00 PM
      // 2:00 PM - 3:30 PM
      // 3:30 PM - 5:00 PM
      // 5:00 PM - 6:30 PM
      
      // Create a mapping of time slot IDs to actual times
      const timeSlots = [
        { start: '8:00 AM', end: '9:30 AM' },
        { start: '9:30 AM', end: '11:00 AM' },
        { start: '11:00 AM', end: '12:30 PM' },
        { start: '12:30 PM', end: '2:00 PM' },
        { start: '2:00 PM', end: '3:30 PM' },
        { start: '3:30 PM', end: '5:00 PM' },
        { start: '5:00 PM', end: '6:30 PM' }
      ];
      
      // Parse the time string to a Date object
      const parseTime = (timeStr: string, date: Date) => {
        const [timePart, period] = timeStr.split(' ');
        let [hours, minutes] = timePart.split(':').map(Number);
        
        if (period === 'PM' && hours < 12) {
          hours += 12;
        } else if (period === 'AM' && hours === 12) {
          hours = 0;
        }
        
        const result = new Date(date);
        result.setHours(hours, minutes || 0, 0, 0);
        return result;
      };
      
      // Map each time slot ID to its corresponding time
      let currentSlotId = gridData.firstTS;
      
      timeSlots.forEach(slot => {
        const startTime = parseTime(slot.start, targetDate);
        const endTime = parseTime(slot.end, targetDate);
        
        // Each booking slot consists of 6 time slots (90 minutes)
        for (let i = 0; i < 6; i++) {
          timeSlotMap[currentSlotId + i] = new Date(startTime.getTime() + i * 15 * 60 * 1000).toISOString();
        }
        
        currentSlotId += 6;
      });
      
      this.client.debug(`Generated ${Object.keys(timeSlotMap).length} time slots`);
      
      const availabilityResults: CourtAvailability[] = [];
      
      // Process each court (resource)
      gridData.resources.forEach((resource: any) => {
        this.client.debug(`Processing court: ${resource.name} (ID: ${resource.id})`);
        
        const court: Court = {
          id: resource.id,
          name: resource.name,
          type: this.extractCourtType(resource.name),
          features: this.extractCourtFeatures(resource.name),
          location: this.extractCourtLocation(resource.name)
        };
        
        // Create a set of all time slots
        const allTimeSlots = new Set<number>();
        for (let ts = resource.firstAvailableTS; ts <= resource.lastAvailableTS; ts++) {
          allTimeSlots.add(ts);
        }
        
        this.client.debug(`Court ${court.name} has ${allTimeSlots.size} total time slots`);
        
        // Remove reserved time slots
        if (resource.reservations && Array.isArray(resource.reservations)) {
          resource.reservations.forEach((reservation: any) => {
            this.client.debug(`Found reservation: ${reservation.usageDescription} by ${reservation.userName} (${reservation.firstTS}-${reservation.lastTS})`);
            for (let ts = reservation.firstTS; ts <= reservation.lastTS; ts++) {
              allTimeSlots.delete(ts);
            }
          });
        }
        
        this.client.debug(`Court ${court.name} has ${allTimeSlots.size} available time slots after removing reservations`);
        
        // Convert remaining time slots to available slots
        const availableSlots: TimeSlot[] = [];
        
        // Group consecutive time slots into blocks
        // From the screenshot, we can see that each booking is 6 time slots (90 minutes)
        // We need to find consecutive blocks of 6 time slots
        const requiredConsecutiveSlots = 6; // 6 slots = 90 minutes
        
        // Sort the available time slots
        const sortedTimeSlots = Array.from(allTimeSlots).sort((a, b) => a - b);
        
        // Find consecutive blocks of 6 time slots
        for (let i = 0; i <= sortedTimeSlots.length - requiredConsecutiveSlots; i++) {
          let isConsecutive = true;
          
          // Check if the next 6 slots are consecutive
          for (let j = 0; j < requiredConsecutiveSlots - 1; j++) {
            if (sortedTimeSlots[i + j + 1] !== sortedTimeSlots[i + j] + 1) {
              isConsecutive = false;
              break;
            }
          }
          
          if (isConsecutive) {
            const startSlot = sortedTimeSlots[i];
            const endSlot = sortedTimeSlots[i + requiredConsecutiveSlots - 1];
            
            // Only add if we have valid time mappings
            if (timeSlotMap[startSlot] && timeSlotMap[endSlot]) {
              availableSlots.push({
                startTime: timeSlotMap[startSlot],
                endTime: new Date(new Date(timeSlotMap[endSlot]).getTime() + 15 * 60 * 1000).toISOString(), // Add 15 minutes to the last slot
                durationMinutes: 90
              });
            }
            
            // Skip ahead to avoid duplicate slots
            i += requiredConsecutiveSlots - 1;
          }
        }
        
        this.client.debug(`Court ${court.name} has ${availableSlots.length} available booking slots after grouping`);
        
        // Filter time slots by start/end time if provided
        let filteredSlots = [...availableSlots];
        
        if (options.startTime) {
          const startTimeObj = new Date(options.startTime);
          filteredSlots = filteredSlots.filter(slot => 
            new Date(slot.startTime) >= startTimeObj
          );
        }
        
        if (options.endTime) {
          const endTimeObj = new Date(options.endTime);
          filteredSlots = filteredSlots.filter(slot => 
            new Date(slot.endTime) <= endTimeObj
          );
        }
        
        this.client.debug(`Court ${court.name} has ${filteredSlots.length} available booking slots after time filtering`);
        
        // Only add courts with available slots
        if (filteredSlots.length > 0) {
          availabilityResults.push({
            court,
            date: options.date,
            availableSlots: filteredSlots
          });
        }
      });
      
      // Apply filters if provided
      let filteredResults = [...availabilityResults];
      
      if (options.type) {
        filteredResults = filteredResults.filter(result => 
          result.court.type && result.court.type.toLowerCase().includes(options.type!.toLowerCase())
        );
      }
      
      if (options.features && options.features.length > 0) {
        filteredResults = filteredResults.filter(result => 
          result.court.features && Array.isArray(result.court.features) && options.features!.every(feature => 
            result.court.features!.some(f => f.toLowerCase().includes(feature.toLowerCase()))
          )
        );
      }
      
      if (options.location) {
        filteredResults = filteredResults.filter(result => 
          result.court.location && result.court.location.toLowerCase().includes(options.location!.toLowerCase())
        );
      }
      
      this.client.debug(`Found ${filteredResults.length} courts with availability after all filtering`);
      return filteredResults;
    } catch (error) {
      if (error instanceof ClubExpressError) {
        throw error;
      }
      
      throw new ClubExpressError(
        'COURTS_AVAILABILITY_FAILED',
        `Failed to find available courts: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get the raw grid data from the last findAvailableCourts call
   * This is used for displaying the full day grid in the CLI
   */
  getLastGridData(): any {
    return this.lastGridData;
  }

  // Add a property to store the last grid data
  private lastGridData: any = null;

  /**
   * Book a court
   * @param options Booking options
   * @returns The created booking
   */
  async bookCourt(options: BookingOptions): Promise<CourtBooking> {
    this.client.debug(`Booking court ${options.courtId} for date ${options.date}`);
    
    // Check if user is authenticated
    if (!this.client.getAuthStatus()) {
      throw new ClubExpressError('COURTS_NOT_AUTHENTICATED', 'User must be authenticated to book a court');
    }
    
    // Validate required options
    if (!options.courtId) {
      throw new ClubExpressError('COURTS_INVALID_OPTIONS', 'Court ID is required to book a court');
    }
    
    if (!options.date) {
      throw new ClubExpressError('COURTS_INVALID_OPTIONS', 'Date is required to book a court');
    }
    
    if (!options.startTime) {
      throw new ClubExpressError('COURTS_INVALID_OPTIONS', 'Start time is required to book a court');
    }
    
    if (!options.endTime) {
      throw new ClubExpressError('COURTS_INVALID_OPTIONS', 'End time is required to book a court');
    }
    
    try {
      // Validate against club rules
      await this.validateBookingAgainstClubRules(options);
      
      // Format date for the request
      const dateObj = new Date(options.date);
      const formattedDate = `${(dateObj.getMonth() + 1)}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
      
      this.client.debug(`Formatted date for booking request: ${formattedDate}`);
      
      // Parse start and end times
      const startTimeObj = new Date(options.startTime);
      const endTimeObj = new Date(options.endTime);
      
      // Format times for the request (HH:MM AM/PM)
      const formatTime = (date: Date) => {
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        // Convert to 12-hour format
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        
        return `${hours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      };
      
      const formattedStartTime = formatTime(startTimeObj);
      const formattedEndTime = formatTime(endTimeObj);
      
      // First, access the reservation page for the specified date
      const reservationPageUrl = `/content.aspx?page_id=1301&club_id=${this.client.getClubId()}&date=${formattedDate}`;
      const reservationPageResponse = await this.client.get(reservationPageUrl);
      
      // Parse the HTML to find the booking form and extract necessary hidden fields
      const $ = this.client.parseHtml(reservationPageResponse.data);
      
      // Find the cell corresponding to the court and time slot
      // This will depend on the actual HTML structure
      // We need to find the correct cell and click on it to initiate the booking
      
      // For now, we'll assume we need to make a POST request to a booking endpoint
      // The actual implementation will need to be adjusted based on the actual booking flow
      
      // Extract hidden form fields
      const hiddenFields: Record<string, string> = {};
      $('input[type="hidden"]').each((_, element) => {
        const name = $(element).attr('name');
        const value = $(element).attr('value') || '';
        if (name) {
          this.client.debug(`Found hidden field: ${name}`);
          hiddenFields[name] = value;
        }
      });
      
      // Prepare the booking payload
      const bookingPayload: Record<string, string> = {
        ...hiddenFields,
        'court_id': options.courtId,
        'date': formattedDate,
        'start_time': formattedStartTime,
        'end_time': formattedEndTime,
      };
      
      // Add optional fields if provided
      if (options.purpose) {
        bookingPayload['purpose'] = options.purpose;
      }
      
      if (options.category) {
        bookingPayload['category'] = options.category;
      }
      
      if (options.participants && options.participants.length > 0) {
        bookingPayload['participants'] = options.participants.join(',');
      }
      
      // Submit the booking form
      // The actual endpoint will need to be determined by analyzing the form action
      const bookingEndpoint = `/content.aspx?page_id=1301&club_id=${this.client.getClubId()}&action=book_court`;
      const bookingResponse = await this.client.post(bookingEndpoint, bookingPayload);
      
      // Parse the response to check for success or errors
      const bookingHtml = this.client.parseHtml(bookingResponse.data);
      
      // Check for error messages
      const errorMessage = bookingHtml('.error-message').text().trim();
      if (errorMessage) {
        throw new ClubExpressError('COURTS_BOOKING_FAILED', `Booking failed: ${errorMessage}`);
      }
      
      // If no error, assume booking was successful
      // Extract booking details from the response
      // This will need to be adjusted based on the actual response structure
      
      // For now, we'll create a placeholder booking object
      const booking: CourtBooking = {
        id: `booking_${Date.now()}`, // Placeholder ID
        court: {
          id: options.courtId,
          name: `Court ${options.courtId}` // Placeholder name
        },
        date: options.date,
        startTime: options.startTime,
        endTime: options.endTime,
        durationMinutes: Math.round((endTimeObj.getTime() - startTimeObj.getTime()) / (1000 * 60)),
        status: 'Confirmed',
        bookedBy: 'Current User', // This should be extracted from the response
        createdAt: new Date().toISOString(),
      };
      
      // Add optional fields if provided
      if (options.purpose) {
        booking.purpose = options.purpose;
      }
      
      if (options.category) {
        booking.category = options.category;
      }
      
      if (options.participants) {
        booking.participants = options.participants;
      }
      
      return booking;
    } catch (error) {
      if (error instanceof ClubExpressError) {
        throw error;
      }
      
      throw new ClubExpressError(
        'COURTS_BOOKING_FAILED',
        `Failed to book court: ${(error as Error).message}`
      );
    }
  }

  /**
   * Validate booking options against club rules
   * @param options Booking options to validate
   * @throws ClubExpressError if the booking violates club rules
   */
  private async validateBookingAgainstClubRules(options: BookingOptions): Promise<void> {
    // Rule 1: A member may reserve only one court per day for play
    // Check if the user already has a booking for this date
    const bookingDate = new Date(options.date);
    const formattedDate = bookingDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const existingBookings = await this.getMyBookings(formattedDate, formattedDate);
    if (existingBookings.length > 0) {
      throw new ClubExpressError(
        'COURTS_BOOKING_RULE_VIOLATION',
        'You can only reserve one court per day. You already have a booking for this date.'
      );
    }
    
    // Rule 2: Reservations can be made up to seven days in advance
    const now = new Date();
    const maxBookingDate = new Date();
    maxBookingDate.setDate(maxBookingDate.getDate() + 7);
    
    if (bookingDate > maxBookingDate) {
      throw new ClubExpressError(
        'COURTS_BOOKING_RULE_VIOLATION',
        `Reservations can only be made up to 7 days in advance (until ${maxBookingDate.toLocaleDateString()}).`
      );
    }
    
    // Check if it's too early to book for the max date
    if (bookingDate.toDateString() === maxBookingDate.toDateString()) {
      const bookingOpenTime = new Date(maxBookingDate);
      bookingOpenTime.setHours(13, 0, 0, 0); // 1:00 PM
      
      if (now < bookingOpenTime) {
        throw new ClubExpressError(
          'COURTS_BOOKING_RULE_VIOLATION',
          `Reservations for ${maxBookingDate.toLocaleDateString()} open at 1:00 PM today.`
        );
      }
    }
    
    // Rule 3: Reservations are made in 1.5-hour blocks starting at 8am
    const startTimeObj = new Date(options.startTime);
    const endTimeObj = new Date(options.endTime);
    
    // Check if the duration is 90 minutes
    const durationMinutes = (endTimeObj.getTime() - startTimeObj.getTime()) / (1000 * 60);
    if (durationMinutes !== 90) {
      throw new ClubExpressError(
        'COURTS_BOOKING_RULE_VIOLATION',
        'Reservations must be made in 1.5-hour blocks.'
      );
    }
    
    // Check if the start time is on a valid 1.5-hour block
    // Valid start times: 8:00, 9:30, 11:00, 12:30, 14:00, 15:30, 17:00, 18:30, 20:00
    const hours = startTimeObj.getHours();
    const minutes = startTimeObj.getMinutes();
    
    const isValidStartTime = 
      (hours === 8 && minutes === 0) ||
      (hours === 9 && minutes === 30) ||
      (hours === 11 && minutes === 0) ||
      (hours === 12 && minutes === 30) ||
      (hours === 14 && minutes === 0) ||
      (hours === 15 && minutes === 30) ||
      (hours === 17 && minutes === 0) ||
      (hours === 18 && minutes === 30) ||
      (hours === 20 && minutes === 0);
    
    if (!isValidStartTime) {
      throw new ClubExpressError(
        'COURTS_BOOKING_RULE_VIOLATION',
        'Reservations must start at valid times (8:00, 9:30, 11:00, 12:30, 14:00, 15:30, 17:00, 18:30, 20:00).'
      );
    }
  }

  /**
   * Cancel a court booking
   * @param options Cancel booking options
   * @returns True if cancellation was successful
   */
  async cancelBooking(options: CancelBookingOptions): Promise<boolean> {
    this.client.debug(`Cancelling booking ${options.bookingId}`);
    
    // Check if user is authenticated
    if (!this.client.getAuthStatus()) {
      throw new ClubExpressError('COURTS_NOT_AUTHENTICATED', 'User must be authenticated to cancel a booking');
    }
    
    // Validate required options
    if (!options.bookingId) {
      throw new ClubExpressError('COURTS_INVALID_OPTIONS', 'Booking ID is required to cancel a booking');
    }
    
    try {
      // Access the booking details page
      const bookingDetailsUrl = `/content.aspx?page_id=1301&club_id=${this.client.getClubId()}&booking_id=${options.bookingId}`;
      const bookingDetailsResponse = await this.client.get(bookingDetailsUrl);
      
      // Parse the HTML to find the cancellation form and extract necessary hidden fields
      const $ = this.client.parseHtml(bookingDetailsResponse.data);
      
      // Extract hidden form fields
      const hiddenFields: Record<string, string> = {};
      $('input[type="hidden"]').each((_, element) => {
        const name = $(element).attr('name');
        const value = $(element).attr('value') || '';
        if (name) {
          this.client.debug(`Found hidden field: ${name}`);
          hiddenFields[name] = value;
        }
      });
      
      // Prepare the cancellation payload
      const cancellationPayload: Record<string, string> = {
        ...hiddenFields,
        'booking_id': options.bookingId,
      };
      
      // Add reason if provided
      if (options.reason) {
        cancellationPayload['reason'] = options.reason;
      }
      
      // Submit the cancellation form
      // The actual endpoint will need to be determined by analyzing the form action
      const cancellationEndpoint = `/content.aspx?page_id=1301&club_id=${this.client.getClubId()}&action=cancel_booking`;
      const cancellationResponse = await this.client.post(cancellationEndpoint, cancellationPayload);
      
      // Parse the response to check for success or errors
      const cancellationHtml = this.client.parseHtml(cancellationResponse.data);
      
      // Check for error messages
      const errorMessage = cancellationHtml('.error-message').text().trim();
      if (errorMessage) {
        throw new ClubExpressError('COURTS_CANCELLATION_FAILED', `Cancellation failed: ${errorMessage}`);
      }
      
      // If no error, assume cancellation was successful
      return true;
    } catch (error) {
      if (error instanceof ClubExpressError) {
        throw error;
      }
      
      throw new ClubExpressError(
        'COURTS_CANCELLATION_FAILED',
        `Failed to cancel booking: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get all bookings for the current user
   * @param startDate Optional start date for filtering bookings
   * @param endDate Optional end date for filtering bookings
   * @returns Array of bookings
   */
  async getMyBookings(startDate?: string, endDate?: string): Promise<CourtBooking[]> {
    this.client.debug('Getting my bookings');
    
    // Check if user is authenticated
    if (!this.client.getAuthStatus()) {
      throw new ClubExpressError('COURTS_NOT_AUTHENTICATED', 'User must be authenticated to get bookings');
    }
    
    try {
      // Format dates for the request if provided
      let queryParams = '';
      
      if (startDate) {
        const startDateObj = new Date(startDate);
        const formattedStartDate = `${(startDateObj.getMonth() + 1).toString().padStart(2, '0')}/${startDateObj.getDate().toString().padStart(2, '0')}/${startDateObj.getFullYear()}`;
        queryParams += `&start_date=${formattedStartDate}`;
      }
      
      if (endDate) {
        const endDateObj = new Date(endDate);
        const formattedEndDate = `${(endDateObj.getMonth() + 1).toString().padStart(2, '0')}/${endDateObj.getDate().toString().padStart(2, '0')}/${endDateObj.getFullYear()}`;
        queryParams += `&end_date=${formattedEndDate}`;
      }
      
      // Access the my bookings page
      const myBookingsUrl = `/content.aspx?page_id=1301&club_id=${this.client.getClubId()}&action=my_bookings${queryParams}`;
      const myBookingsResponse = await this.client.get(myBookingsUrl);
      
      // Parse the HTML to extract booking information
      const $ = this.client.parseHtml(myBookingsResponse.data);
      
      // Extract bookings from the page
      // This will depend on the actual HTML structure
      const bookings: CourtBooking[] = [];
      
      // For now, we'll assume bookings are displayed in a table
      $('table.bookings-table tr').each((index, row) => {
        // Skip the header row
        if (index === 0) {
          return;
        }
        
        const $row = $(row);
        const cells = $row.find('td');
        
        // Extract booking details from the cells
        // This will need to be adjusted based on the actual table structure
        const bookingId = $(cells[0]).text().trim();
        const courtName = $(cells[1]).text().trim();
        const dateText = $(cells[2]).text().trim();
        const timeText = $(cells[3]).text().trim();
        const status = $(cells[4]).text().trim();
        
        // Skip if any required field is missing
        if (!bookingId || !courtName || !dateText || !timeText) {
          return;
        }
        
        // Parse date and time
        const dateMatch = dateText.match(/(\d+)\/(\d+)\/(\d+)/);
        const timeMatch = timeText.match(/(\d+):(\d+)\s*(AM|PM)\s*-\s*(\d+):(\d+)\s*(AM|PM)/i);
        
        if (!dateMatch || !timeMatch) {
          return;
        }
        
        // Create date object
        const month = parseInt(dateMatch[1]) - 1;
        const day = parseInt(dateMatch[2]);
        const year = parseInt(dateMatch[3]);
        
        // Parse start time
        let startHour = parseInt(timeMatch[1]);
        const startMinute = parseInt(timeMatch[2]);
        const startPeriod = timeMatch[3].toUpperCase();
        
        if (startPeriod === 'PM' && startHour < 12) {
          startHour += 12;
        } else if (startPeriod === 'AM' && startHour === 12) {
          startHour = 0;
        }
        
        // Parse end time
        let endHour = parseInt(timeMatch[4]);
        const endMinute = parseInt(timeMatch[5]);
        const endPeriod = timeMatch[6].toUpperCase();
        
        if (endPeriod === 'PM' && endHour < 12) {
          endHour += 12;
        } else if (endPeriod === 'AM' && endHour === 12) {
          endHour = 0;
        }
        
        // Create date objects for the booking
        const date = new Date(year, month, day);
        const startTime = new Date(year, month, day, startHour, startMinute);
        const endTime = new Date(year, month, day, endHour, endMinute);
        
        // Calculate duration in minutes
        const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
        
        // Extract court ID from the court name
        const courtMatch = courtName.match(/Court\s+(\d+)/i);
        const courtId = courtMatch ? courtMatch[1] : '';
        
        // Create booking object
        const booking: CourtBooking = {
          id: bookingId,
          court: {
            id: courtId,
            name: courtName
          },
          date: date.toISOString(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          durationMinutes,
          status,
          bookedBy: 'Current User', // This should be extracted from the page if available
          createdAt: new Date().toISOString(), // This should be extracted from the page if available
        };
        
        bookings.push(booking);
      });
      
      this.client.debug(`Found ${bookings.length} bookings`);
      return bookings;
    } catch (error) {
      if (error instanceof ClubExpressError) {
        throw error;
      }
      
      throw new ClubExpressError(
        'COURTS_GET_BOOKINGS_FAILED',
        `Failed to get bookings: ${(error as Error).message}`
      );
    }
  }

  /**
   * Extract the court type from the court name
   * @param courtName The court name
   * @returns The court type
   */
  private extractCourtType(courtName: string): string {
    // Default to 'Tennis' if no specific type is found
    let type = 'Tennis';
    
    // Check for specific court types in the name
    if (courtName.toLowerCase().includes('pickleball')) {
      type = 'Pickleball';
    } else if (courtName.toLowerCase().includes('squash')) {
      type = 'Squash';
    } else if (courtName.toLowerCase().includes('racquetball')) {
      type = 'Racquetball';
    } else if (courtName.toLowerCase().includes('badminton')) {
      type = 'Badminton';
    }
    
    return type;
  }

  /**
   * Extract court features from the court name
   * @param courtName The court name
   * @returns Array of court features
   */
  private extractCourtFeatures(courtName: string): string[] {
    const features: string[] = [];
    
    // Check for common court features
    if (courtName.toLowerCase().includes('indoor')) {
      features.push('Indoor');
    }
    
    if (courtName.toLowerCase().includes('outdoor')) {
      features.push('Outdoor');
    }
    
    if (courtName.toLowerCase().includes('clay')) {
      features.push('Clay');
    }
    
    if (courtName.toLowerCase().includes('hard')) {
      features.push('Hard');
    }
    
    if (courtName.toLowerCase().includes('grass')) {
      features.push('Grass');
    }
    
    if (courtName.toLowerCase().includes('lighted') || courtName.toLowerCase().includes('lights')) {
      features.push('Lighted');
    }
    
    return features;
  }

  /**
   * Extract court location from the court name
   * @param courtName The court name
   * @returns The court location
   */
  private extractCourtLocation(courtName: string): string {
    // Default to 'Main' if no specific location is found
    let location = 'Main';
    
    // Check for location indicators in the name
    if (courtName.toLowerCase().includes('north')) {
      location = 'North';
    } else if (courtName.toLowerCase().includes('south')) {
      location = 'South';
    } else if (courtName.toLowerCase().includes('east')) {
      location = 'East';
    } else if (courtName.toLowerCase().includes('west')) {
      location = 'West';
    } else if (courtName.toLowerCase().includes('center')) {
      location = 'Center';
    }
    
    return location;
  }
} 