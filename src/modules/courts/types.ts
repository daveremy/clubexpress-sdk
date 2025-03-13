/**
 * Types for the courts module
 */

/**
 * Represents a court in the ClubExpress system
 */
export interface Court {
  /**
   * Unique identifier for the court
   */
  id: string;
  
  /**
   * Name of the court
   */
  name: string;
  
  /**
   * Description of the court (if available)
   */
  description?: string;
  
  /**
   * Type of court (e.g., "Pickleball", "Tennis", etc.)
   */
  type?: string;
  
  /**
   * Features or attributes of the court (e.g., "Lighted", "Indoor", etc.)
   */
  features?: string[];
  
  /**
   * Location information for the court
   */
  location?: string;
  
  /**
   * Raw data from ClubExpress for this court
   */
  raw?: Record<string, any>;
}

/**
 * Represents a time slot for court availability
 */
export interface TimeSlot {
  /**
   * Start time of the slot (ISO string)
   */
  startTime: string;
  
  /**
   * End time of the slot (ISO string)
   */
  endTime: string;
  
  /**
   * Duration of the slot in minutes
   */
  durationMinutes: number;
}

/**
 * Represents the availability of a court on a specific date
 */
export interface CourtAvailability {
  /**
   * Court information
   */
  court: Court;
  
  /**
   * Date for which availability is being checked (ISO string)
   */
  date: string;
  
  /**
   * Available time slots for the court
   */
  availableSlots: TimeSlot[];
}

/**
 * Options for filtering courts
 */
export interface CourtFilterOptions {
  /**
   * Filter by court type
   */
  type?: string;
  
  /**
   * Filter by court features
   */
  features?: string[];
  
  /**
   * Filter by court location
   */
  location?: string;
}

/**
 * Options for finding available courts
 */
export interface AvailabilityOptions extends CourtFilterOptions {
  /**
   * Date for which to check availability (ISO string)
   */
  date: string;
  
  /**
   * Start time for availability window (ISO string)
   */
  startTime?: string;
  
  /**
   * End time for availability window (ISO string)
   */
  endTime?: string;
  
  /**
   * Minimum duration required in minutes
   */
  minDurationMinutes?: number;
}

/**
 * Options for booking a court
 */
export interface BookingOptions {
  /**
   * Court ID to book
   */
  courtId: string;
  
  /**
   * Date for the booking (ISO string)
   */
  date: string;
  
  /**
   * Start time for the booking (ISO string)
   */
  startTime: string;
  
  /**
   * End time for the booking (ISO string)
   */
  endTime: string;
  
  /**
   * Purpose or notes for the booking
   */
  purpose?: string;
  
  /**
   * Category or type of booking (if applicable)
   */
  category?: string;
  
  /**
   * Additional participants for the booking
   */
  participants?: string[];
}

/**
 * Represents a court booking
 */
export interface CourtBooking {
  /**
   * Unique identifier for the booking
   */
  id: string;
  
  /**
   * Court information
   */
  court: Court;
  
  /**
   * Date of the booking (ISO string)
   */
  date: string;
  
  /**
   * Start time of the booking (ISO string)
   */
  startTime: string;
  
  /**
   * End time of the booking (ISO string)
   */
  endTime: string;
  
  /**
   * Duration of the booking in minutes
   */
  durationMinutes: number;
  
  /**
   * Purpose or notes for the booking
   */
  purpose?: string;
  
  /**
   * Category or type of booking
   */
  category?: string;
  
  /**
   * Status of the booking (e.g., "Confirmed", "Pending", "Cancelled")
   */
  status: string;
  
  /**
   * User who made the booking
   */
  bookedBy: string;
  
  /**
   * Additional participants for the booking
   */
  participants?: string[];
  
  /**
   * Timestamp when the booking was created
   */
  createdAt: string;
  
  /**
   * Raw data from ClubExpress for this booking
   */
  raw?: Record<string, any>;
}

/**
 * Options for cancelling a booking
 */
export interface CancelBookingOptions {
  /**
   * Booking ID to cancel
   */
  bookingId: string;
  
  /**
   * Reason for cancellation
   */
  reason?: string;
} 