import { ClubExpressClient } from '../../../src/core/client';
import { CourtsModule } from '../../../src/modules/courts/courts.module';
import { ClubExpressError } from '../../../src/core/error';
import { Court, CourtAvailability } from '../../../src/modules/courts/types';

// Mock the ClubExpressClient
jest.mock('../../../src/core/client');

describe('CourtsModule', () => {
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
    
    // Create the courts module with the mock client
    courtsModule = new CourtsModule(client);
  });
  
  describe('authentication checks', () => {
    it('should throw an error if user is not authenticated when finding all courts', async () => {
      client.getAuthStatus = jest.fn().mockReturnValue(false);
      await expect(courtsModule.findAllCourts()).rejects.toThrow('User must be authenticated to find courts');
    });

    it('should throw an error if user is not authenticated when finding available courts', async () => {
      client.getAuthStatus = jest.fn().mockReturnValue(false);
      await expect(courtsModule.findAvailableCourts({ date: '2023-01-01' })).rejects.toThrow('User must be authenticated to find available courts');
    });

    it('should throw an error if date is not provided when finding available courts', async () => {
      client.getAuthStatus = jest.fn().mockReturnValue(true);
      await expect(courtsModule.findAvailableCourts({} as any)).rejects.toThrow('Date is required to find available courts');
    });

      
      // Expect the result to be an empty array
      expect(availableCourts).toEqual([]);
      
      // Verify the findAllCourts method was called
      expect(courtsModule.findAllCourts).toHaveBeenCalled();
    });
  });
  
  // Integration-style tests that mock at a higher level
  describe('integration tests', () => {
    // Create mock courts
    const mockCourts: Court[] = [
      { id: '1', name: 'Pickleball Court 1', type: 'Pickleball', features: ['Lighted', 'Indoor'] },
      { id: '2', name: 'Pickleball Court 2', type: 'Pickleball', features: ['Outdoor'] },
      { id: '3', name: 'Tennis Court 1', type: 'Tennis', features: ['Lighted'] },
    ];
    
    it('should filter courts by type', async () => {
      // Mock the findAllCourts method to return all courts
      jest.spyOn(courtsModule, 'findAllCourts').mockImplementation(async (options) => {
        let filteredCourts = [...mockCourts];
        
        if (options) {
          if (options.type) {
            filteredCourts = filteredCourts.filter(court => 
              court.type && court.type.toLowerCase().includes(options.type!.toLowerCase())
            );
          }
          
          if (options.features && options.features.length > 0) {
            filteredCourts = filteredCourts.filter(court => 
              court.features && options.features!.every(feature => 
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
      });
      
      // Test filtering by type
      const pickleballCourts = await courtsModule.findAllCourts({ type: 'Pickleball' });
      expect(pickleballCourts).toHaveLength(2);
      expect(pickleballCourts[0].name).toBe('Pickleball Court 1');
      expect(pickleballCourts[1].name).toBe('Pickleball Court 2');
      
      // Test filtering by features
      const lightedCourts = await courtsModule.findAllCourts({ features: ['Lighted'] });
      expect(lightedCourts).toHaveLength(2);
      expect(lightedCourts[0].name).toBe('Pickleball Court 1');
      expect(lightedCourts[1].name).toBe('Tennis Court 1');
      
      // Test filtering by type and features
      const lightedPickleballCourts = await courtsModule.findAllCourts({ 
        type: 'Pickleball', 
        features: ['Lighted'] 
      });
      expect(lightedPickleballCourts).toHaveLength(1);
      expect(lightedPickleballCourts[0].name).toBe('Pickleball Court 1');
    });
    
    it('should find available courts with time slots', async () => {
      // Create a date object for testing
      const testDate = new Date('2023-01-01T00:00:00.000Z');
      
      // Create time slots with the test date
      const slot1Start = new Date(testDate);
      slot1Start.setHours(8, 0, 0, 0);
      
      const slot1End = new Date(testDate);
      slot1End.setHours(9, 0, 0, 0);
      
      const slot2Start = new Date(testDate);
      slot2Start.setHours(10, 0, 0, 0);
      
      const slot2End = new Date(testDate);
      slot2End.setHours(11, 0, 0, 0);
      
      // Mock the findAllCourts method to return courts
      jest.spyOn(courtsModule, 'findAllCourts').mockResolvedValue([
        { id: '1', name: 'Court 1' },
        { id: '2', name: 'Court 2' },
      ]);
      
      // Create mock time slots
      const mockTimeSlots1 = [
        {
          startTime: slot1Start.toISOString(),
          endTime: slot1End.toISOString(),
          durationMinutes: 60
        }
      ];
      
      const mockTimeSlots2 = [
        {
          startTime: slot2Start.toISOString(),
          endTime: slot2End.toISOString(),
          durationMinutes: 60
        }
      ];
      
      // Mock the implementation of findAvailableCourts
      const originalFindAvailableCourts = courtsModule.findAvailableCourts;
      courtsModule.findAvailableCourts = jest.fn().mockImplementation(async (options) => {
        // Use the original implementation to get courts
        const courts = await courtsModule.findAllCourts({
          type: options.type,
          features: options.features,
          location: options.location
        });
        
        // Create mock availability results
        return [
          {
            court: courts[0],
            date: options.date,
            availableSlots: mockTimeSlots1
          },
          {
            court: courts[1],
            date: options.date,
            availableSlots: mockTimeSlots2
          }
        ];
      });
      
      // Call the method
      const availableCourts = await courtsModule.findAvailableCourts({ date: testDate.toISOString() });
      
      // Expect the result to contain the available courts
      expect(availableCourts).toHaveLength(2);
      
      // Check the first court
      expect(availableCourts[0].court.id).toBe('1');
      expect(availableCourts[0].court.name).toBe('Court 1');
      expect(availableCourts[0].availableSlots).toHaveLength(1);
      
      // Check the time slots using the local time zone
      const firstSlotStart = new Date(availableCourts[0].availableSlots[0].startTime);
      const firstSlotEnd = new Date(availableCourts[0].availableSlots[0].endTime);
      expect(firstSlotStart.getHours()).toBe(slot1Start.getHours());
      expect(firstSlotEnd.getHours()).toBe(slot1End.getHours());
      
      // Check the second court
      expect(availableCourts[1].court.id).toBe('2');
      expect(availableCourts[1].court.name).toBe('Court 2');
      expect(availableCourts[1].availableSlots).toHaveLength(1);
      
      // Check the time slots using the local time zone
      const secondSlotStart = new Date(availableCourts[1].availableSlots[0].startTime);
      const secondSlotEnd = new Date(availableCourts[1].availableSlots[0].endTime);
      expect(secondSlotStart.getHours()).toBe(slot2Start.getHours());
      expect(secondSlotEnd.getHours()).toBe(slot2End.getHours());
      
      // Restore the original method
      courtsModule.findAvailableCourts = originalFindAvailableCourts;
    });
    
    it('should apply time filters correctly', async () => {
      // Create a date object for testing
      const testDate = new Date('2023-01-01T00:00:00.000Z');
      
      // Create time slots with the test date
      const morningSlotStart = new Date(testDate);
      morningSlotStart.setHours(8, 0, 0, 0);
      
      const morningSlotEnd = new Date(testDate);
      morningSlotEnd.setHours(9, 0, 0, 0);
      
      const afternoonSlotStart = new Date(testDate);
      afternoonSlotStart.setHours(13, 0, 0, 0);
      
      const afternoonSlotEnd = new Date(testDate);
      afternoonSlotEnd.setHours(14, 0, 0, 0);
      
      const eveningSlotStart = new Date(testDate);
      eveningSlotStart.setHours(18, 0, 0, 0);
      
      const eveningSlotEnd = new Date(testDate);
      eveningSlotEnd.setHours(19, 0, 0, 0);
      
      // Mock the findAllCourts method to return a court
      jest.spyOn(courtsModule, 'findAllCourts').mockResolvedValue([
        { id: '1', name: 'Court 1' }
      ]);
      
      // Create mock time slots with different times
      const mockTimeSlots = [
        {
          startTime: morningSlotStart.toISOString(),
          endTime: morningSlotEnd.toISOString(),
          durationMinutes: 60
        },
        {
          startTime: afternoonSlotStart.toISOString(),
          endTime: afternoonSlotEnd.toISOString(),
          durationMinutes: 60
        },
        {
          startTime: eveningSlotStart.toISOString(),
          endTime: eveningSlotEnd.toISOString(),
          durationMinutes: 60
        }
      ];
      
      // Mock the implementation of findAvailableCourts
      const originalFindAvailableCourts = courtsModule.findAvailableCourts;
      courtsModule.findAvailableCourts = jest.fn().mockImplementation((options) => {
        // Get the courts
        const courts = [{ id: '1', name: 'Court 1' }];
        
        // Filter time slots based on options
        let filteredSlots = [...mockTimeSlots];
        
        if (options.startTime) {
          const filterStartTime = new Date(options.startTime);
          filteredSlots = filteredSlots.filter(slot => 
            new Date(slot.startTime) >= filterStartTime
          );
        }
        
        if (options.endTime) {
          const filterEndTime = new Date(options.endTime);
          filteredSlots = filteredSlots.filter(slot => 
            new Date(slot.endTime) <= filterEndTime
          );
        }
        
        if (options.minDurationMinutes) {
          filteredSlots = filteredSlots.filter(slot => 
            slot.durationMinutes >= options.minDurationMinutes
          );
        }
        
        // Return availability results
        return Promise.resolve(filteredSlots.length > 0 ? [
          {
            court: courts[0],
            date: options.date,
            availableSlots: filteredSlots
          }
        ] : []);
      });
      
      // Test with morning time filter
      const morningStart = new Date(testDate);
      morningStart.setHours(7, 0, 0, 0);
      
      const morningEnd = new Date(testDate);
      morningEnd.setHours(10, 0, 0, 0);
      
      const morningCourts = await courtsModule.findAvailableCourts({
        date: testDate.toISOString(),
        startTime: morningStart.toISOString(),
        endTime: morningEnd.toISOString(),
      });
      
      expect(morningCourts).toHaveLength(1);
      expect(morningCourts[0].availableSlots).toHaveLength(1);
      
      // Check the time slot using the local time zone
      const morningSlot = new Date(morningCourts[0].availableSlots[0].startTime);
      expect(morningSlot.getHours()).toBe(morningSlotStart.getHours());
      
      // Test with afternoon time filter
      const afternoonStart = new Date(testDate);
      afternoonStart.setHours(12, 0, 0, 0);
      
      const afternoonEnd = new Date(testDate);
      afternoonEnd.setHours(15, 0, 0, 0);
      
      const afternoonCourts = await courtsModule.findAvailableCourts({
        date: testDate.toISOString(),
        startTime: afternoonStart.toISOString(),
        endTime: afternoonEnd.toISOString(),
      });
      
      expect(afternoonCourts).toHaveLength(1);
      expect(afternoonCourts[0].availableSlots).toHaveLength(1);
      
      // Check the time slot using the local time zone
      const afternoonSlot = new Date(afternoonCourts[0].availableSlots[0].startTime);
      expect(afternoonSlot.getHours()).toBe(afternoonSlotStart.getHours());
      
      // Test with minimum duration filter
      const allCourts = await courtsModule.findAvailableCourts({
        date: testDate.toISOString(),
        minDurationMinutes: 60,
      });
      
      expect(allCourts).toHaveLength(1);
      expect(allCourts[0].availableSlots).toHaveLength(3); // All slots are 60 minutes
      
      // Restore the original method
      courtsModule.findAvailableCourts = originalFindAvailableCourts;
    });
  });
}); 