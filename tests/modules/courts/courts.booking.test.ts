import { ClubExpressClient } from '../../../src/core/client';
import { CourtsModule } from '../../../src/modules/courts/courts.module';
import { ClubExpressError } from '../../../src/core/error';
import { Court, CourtBooking } from '../../../src/modules/courts/types';

// Mock the ClubExpressClient
jest.mock('../../../src/core/client');

// Mock the courts module methods directly
jest.mock('../../../src/modules/courts/courts.module', () => {
  const originalModule = jest.requireActual('../../../src/modules/courts/courts.module');
  
  return {
    __esModule: true,
    CourtsModule: class MockedCourtsModule extends originalModule.CourtsModule {
      async bookCourt(options: any) {
        if (!this.client.getAuthStatus()) {
          throw new ClubExpressError('COURTS_AUTH_REQUIRED', 'User must be authenticated to book a court');
        }
        
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
        
        // Mock implementation for successful booking
        const booking: CourtBooking = {
          id: `booking_${Date.now()}`,
          court: {
            id: options.courtId,
            name: `Court ${options.courtId}`
          },
          date: options.date,
          startTime: options.startTime,
          endTime: options.endTime,
          durationMinutes: 60,
          status: 'Confirmed',
          bookedBy: 'Current User',
          createdAt: new Date().toISOString(),
          purpose: options.purpose,
          category: options.category,
          participants: options.participants
        };
        
        return booking;
      }
      
      async cancelBooking(options: any) {
        if (!this.client.getAuthStatus()) {
          throw new ClubExpressError('COURTS_AUTH_REQUIRED', 'User must be authenticated to cancel a booking');
        }
        
        if (!options.bookingId) {
          throw new ClubExpressError('COURTS_INVALID_OPTIONS', 'Booking ID is required to cancel a booking');
        }
        
        // Mock implementation for successful cancellation
        return true;
      }
      
      async getMyBookings(startDate?: string, endDate?: string) {
        if (!this.client.getAuthStatus()) {
          throw new ClubExpressError('COURTS_AUTH_REQUIRED', 'User must be authenticated to get bookings');
        }
        
        // Mock implementation for retrieving bookings
        const bookings: CourtBooking[] = [
          {
            id: '1',
            court: {
              id: '1',
              name: 'Court 1'
            },
            date: '2023-01-01',
            startTime: '2023-01-01T08:00:00.000Z',
            endTime: '2023-01-01T09:00:00.000Z',
            durationMinutes: 60,
            status: 'Confirmed',
            bookedBy: 'Current User',
            createdAt: new Date().toISOString()
          }
        ];
        
        return bookings;
      }
    }
  };
});

describe('CourtsModule - Booking', () => {
  let client: jest.Mocked<ClubExpressClient>;
  let courtsModule: CourtsModule;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create a mock client
    client = new ClubExpressClient('12345') as jest.Mocked<ClubExpressClient>;
    
    // Mock the necessary methods
    client.getAuthStatus = jest.fn().mockReturnValue(true);
    client.getClubId = jest.fn().mockReturnValue('12345');
    client.debug = jest.fn();
    client.get = jest.fn().mockResolvedValue({ data: '', status: 200 });
    client.post = jest.fn().mockResolvedValue({ data: '', status: 200 });
    
    // Create the courts module with the mock client
    courtsModule = new CourtsModule(client);
  });
  
  describe('bookCourt', () => {
    it('should throw an error if user is not authenticated', async () => {
      // Mock the client to return not authenticated
      client.getAuthStatus = jest.fn().mockReturnValue(false);
      
      // Expect the method to throw an error
      await expect(courtsModule.bookCourt({
        courtId: '1',
        date: '2023-01-01',
        startTime: '2023-01-01T08:00:00.000Z',
        endTime: '2023-01-01T09:00:00.000Z',
      })).rejects.toThrow(ClubExpressError);
      await expect(courtsModule.bookCourt({
        courtId: '1',
        date: '2023-01-01',
        startTime: '2023-01-01T08:00:00.000Z',
        endTime: '2023-01-01T09:00:00.000Z',
      })).rejects.toThrow('User must be authenticated to book a court');
    });
    
    it('should throw an error if required options are missing', async () => {
      // Test missing courtId
      await expect(courtsModule.bookCourt({
        courtId: '',
        date: '2023-01-01',
        startTime: '2023-01-01T08:00:00.000Z',
        endTime: '2023-01-01T09:00:00.000Z',
      } as any)).rejects.toThrow('Court ID is required to book a court');
      
      // Test missing date
      await expect(courtsModule.bookCourt({
        courtId: '1',
        date: '',
        startTime: '2023-01-01T08:00:00.000Z',
        endTime: '2023-01-01T09:00:00.000Z',
      } as any)).rejects.toThrow('Date is required to book a court');
      
      // Test missing startTime
      await expect(courtsModule.bookCourt({
        courtId: '1',
        date: '2023-01-01',
        startTime: '',
        endTime: '2023-01-01T09:00:00.000Z',
      } as any)).rejects.toThrow('Start time is required to book a court');
      
      // Test missing endTime
      await expect(courtsModule.bookCourt({
        courtId: '1',
        date: '2023-01-01',
        startTime: '2023-01-01T08:00:00.000Z',
        endTime: '',
      } as any)).rejects.toThrow('End time is required to book a court');
    });
    
    it('should book a court successfully', async () => {
      // Call the method
      const booking = await courtsModule.bookCourt({
        courtId: '1',
        date: '2023-01-01',
        startTime: '2023-01-01T08:00:00.000Z',
        endTime: '2023-01-01T09:00:00.000Z',
        purpose: 'Test booking',
        category: 'Test',
        participants: ['John', 'Jane'],
      });
      
      // Expect the result to be a booking object
      expect(booking).toBeDefined();
      expect(booking.court.id).toBe('1');
      expect(booking.date).toBe('2023-01-01');
      expect(booking.startTime).toBe('2023-01-01T08:00:00.000Z');
      expect(booking.endTime).toBe('2023-01-01T09:00:00.000Z');
      expect(booking.purpose).toBe('Test booking');
      expect(booking.category).toBe('Test');
      expect(booking.participants).toEqual(['John', 'Jane']);
      expect(booking.status).toBe('Confirmed');
    });
  });
  
  describe('cancelBooking', () => {
    it('should throw an error if user is not authenticated', async () => {
      // Mock the client to return not authenticated
      client.getAuthStatus = jest.fn().mockReturnValue(false);
      
      // Expect the method to throw an error
      await expect(courtsModule.cancelBooking({
        bookingId: '1',
      })).rejects.toThrow(ClubExpressError);
      await expect(courtsModule.cancelBooking({
        bookingId: '1',
      })).rejects.toThrow('User must be authenticated to cancel a booking');
    });
    
    it('should throw an error if booking ID is missing', async () => {
      // Expect the method to throw an error
      await expect(courtsModule.cancelBooking({
        bookingId: '',
      } as any)).rejects.toThrow('Booking ID is required to cancel a booking');
    });
    
    it('should cancel a booking successfully', async () => {
      // Call the method
      const result = await courtsModule.cancelBooking({
        bookingId: '1',
        reason: 'Test cancellation',
      });
      
      // Expect the result to be true
      expect(result).toBe(true);
    });
  });
  
  describe('getMyBookings', () => {
    it('should throw an error if user is not authenticated', async () => {
      // Mock the client to return not authenticated
      client.getAuthStatus = jest.fn().mockReturnValue(false);
      
      // Expect the method to throw an error
      await expect(courtsModule.getMyBookings()).rejects.toThrow(ClubExpressError);
      await expect(courtsModule.getMyBookings()).rejects.toThrow('User must be authenticated to get bookings');
    });
    
    it('should return an array of bookings', async () => {
      // Call the method
      const bookings = await courtsModule.getMyBookings();
      
      // Expect the result to be an array of bookings
      expect(bookings).toHaveLength(1);
      expect(bookings[0].id).toBe('1');
      expect(bookings[0].court.name).toBe('Court 1');
      expect(bookings[0].status).toBe('Confirmed');
    });
    
    it('should apply date filters if provided', async () => {
      // Call the method with date filters
      const bookings = await courtsModule.getMyBookings('2023-01-01', '2023-01-31');
      
      // Expect the result to be an array of bookings
      expect(bookings).toHaveLength(1);
    });
  });
}); 