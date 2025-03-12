import { ClubExpressClient } from '../../../src/core/client';
import { AuthModule } from '../../../src/modules/auth/auth.module';
import { LoginCredentials } from '../../../src/modules/auth/types';

// Mock the ClubExpressClient
jest.mock('../../../src/core/client');

describe('AuthModule', () => {
  let authModule: AuthModule;
  let mockClient: jest.Mocked<ClubExpressClient>;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create a mock client
    mockClient = new ClubExpressClient() as jest.Mocked<ClubExpressClient>;
    
    // Set up mock methods
    mockClient.getClubId.mockReturnValue('123456');
    mockClient.isLoggedIn.mockReturnValue(false);
    
    // Create the auth module with the mock client
    authModule = new AuthModule(mockClient);
  });
  
  describe('login', () => {
    const credentials: LoginCredentials = {
      username: 'testuser',
      password: 'testpassword',
    };
    
    it('should successfully log in', async () => {
      // Mock the login page response
      const mockLoginPageHtml = `
        <form>
          <input type="hidden" id="__VIEWSTATE" value="viewStateValue" />
          <input type="hidden" id="__VIEWSTATEGENERATOR" value="viewStateGeneratorValue" />
          <input type="hidden" id="__EVENTVALIDATION" value="eventValidationValue" />
        </form>
      `;
      
      // Mock the successful login response
      const mockLoginResponseHtml = `
        <div class="user-name">Test User</div>
      `;
      
      // Set up the mock client responses
      mockClient.get.mockResolvedValueOnce({
        data: mockLoginPageHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
      });
      
      mockClient.post.mockResolvedValueOnce({
        data: mockLoginResponseHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
      });
      
      // Mock the HTML parsing
      const mockLoginPageCheerio = {
        val: jest.fn().mockReturnValue('viewStateValue'),
      };
      
      const mockLoginResponseCheerio = {
        text: jest.fn().mockReturnValue(''),
      };
      
      const mockUserNameCheerio = {
        text: jest.fn().mockReturnValue('Test User'),
      };
      
      // Set up the parseHtml mock to return a function that can be called with selectors
      mockClient.parseHtml.mockImplementation(() => {
        return ((selector: string) => {
          if (selector === '#__VIEWSTATE') return mockLoginPageCheerio;
          if (selector === '#__VIEWSTATEGENERATOR') return mockLoginPageCheerio;
          if (selector === '#__EVENTVALIDATION') return mockLoginPageCheerio;
          if (selector === '#ctl01_ContentPlaceHolder1_Login1_FailureText') return mockLoginResponseCheerio;
          if (selector === '.user-name') return mockUserNameCheerio;
          return { val: jest.fn(), text: jest.fn() };
        }) as any;
      });
      
      // Call the login method
      const result = await authModule.login(credentials);
      
      // Verify the result
      expect(result).toEqual({
        success: true,
        user: {
          name: 'Test User',
        },
      });
      
      // Verify the client methods were called correctly
      expect(mockClient.get).toHaveBeenCalledWith('/clubs/123456/login.aspx');
      expect(mockClient.parseHtml).toHaveBeenCalledTimes(2);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/clubs/123456/login.aspx',
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
      expect(mockClient.setAuthStatus).toHaveBeenCalledWith(true);
    });
    
    it('should handle login failure', async () => {
      // Mock the login page response
      const mockLoginPageHtml = `
        <form>
          <input type="hidden" id="__VIEWSTATE" value="viewStateValue" />
          <input type="hidden" id="__VIEWSTATEGENERATOR" value="viewStateGeneratorValue" />
          <input type="hidden" id="__EVENTVALIDATION" value="eventValidationValue" />
        </form>
      `;
      
      // Mock the failed login response
      const mockLoginResponseHtml = `
        <span id="ctl01_ContentPlaceHolder1_Login1_FailureText">Invalid username or password.</span>
      `;
      
      // Set up the mock client responses
      mockClient.get.mockResolvedValueOnce({
        data: mockLoginPageHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
      });
      
      mockClient.post.mockResolvedValueOnce({
        data: mockLoginResponseHtml,
        status: 200,
        statusText: 'OK',
        headers: {},
      });
      
      // Mock the HTML parsing
      const mockLoginPageCheerio = {
        val: jest.fn().mockReturnValue('viewStateValue'),
      };
      
      const mockLoginResponseCheerio = {
        text: jest.fn().mockReturnValue('Invalid username or password.'),
      };
      
      const mockUserNameCheerio = {
        text: jest.fn().mockReturnValue(''),
      };
      
      // Set up the parseHtml mock to return a function that can be called with selectors
      mockClient.parseHtml.mockImplementation(() => {
        return ((selector: string) => {
          if (selector === '#__VIEWSTATE') return mockLoginPageCheerio;
          if (selector === '#__VIEWSTATEGENERATOR') return mockLoginPageCheerio;
          if (selector === '#__EVENTVALIDATION') return mockLoginPageCheerio;
          if (selector === '#ctl01_ContentPlaceHolder1_Login1_FailureText') return mockLoginResponseCheerio;
          if (selector === '.user-name') return mockUserNameCheerio;
          return { val: jest.fn(), text: jest.fn() };
        }) as any;
      });
      
      // Call the login method
      const result = await authModule.login(credentials);
      
      // Verify the result
      expect(result).toEqual({
        success: false,
        error: 'Invalid username or password.',
      });
      
      // Verify the client methods were called correctly
      expect(mockClient.get).toHaveBeenCalledWith('/clubs/123456/login.aspx');
      expect(mockClient.parseHtml).toHaveBeenCalledTimes(2);
      expect(mockClient.post).toHaveBeenCalledWith(
        '/clubs/123456/login.aspx',
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        })
      );
      expect(mockClient.setAuthStatus).not.toHaveBeenCalled();
    });
  });
  
  describe('logout', () => {
    it('should successfully log out', async () => {
      // Mock the logout response
      mockClient.get.mockResolvedValueOnce({
        data: '',
        status: 200,
        statusText: 'OK',
        headers: {},
      });
      
      // Call the logout method
      const result = await authModule.logout();
      
      // Verify the result
      expect(result).toEqual({
        success: true,
      });
      
      // Verify the client methods were called correctly
      expect(mockClient.get).toHaveBeenCalledWith('/clubs/123456/logout.aspx');
      expect(mockClient.clearCookies).toHaveBeenCalled();
      expect(mockClient.setAuthStatus).toHaveBeenCalledWith(false);
    });
  });
  
  describe('isLoggedIn', () => {
    it('should return the login status from the client', () => {
      mockClient.isLoggedIn.mockReturnValue(true);
      expect(authModule.isLoggedIn()).toBe(true);
      
      mockClient.isLoggedIn.mockReturnValue(false);
      expect(authModule.isLoggedIn()).toBe(false);
    });
  });
  
  describe('getCurrentUser', () => {
    it('should return null when not logged in', () => {
      expect(authModule.getCurrentUser()).toBeNull();
    });
  });
}); 