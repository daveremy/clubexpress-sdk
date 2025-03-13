import { ClubExpressClient } from '../../core/client';
import { ClubExpressError } from '../../core/error';
import * as cheerio from 'cheerio';

/**
 * Authentication module for ClubExpress
 * Handles login, logout, and session management
 */
export class AuthModule {
  constructor(private client: ClubExpressClient) {}

  /**
   * Login to ClubExpress
   * @param username Username
   * @param password Password
   * @param rememberMe Remember me on this computer
   * @returns True if login was successful
   */
  async login(username: string, password: string, rememberMe: boolean = false): Promise<boolean> {
    if (!username || !password) {
      throw new ClubExpressError('LOGIN_MISSING_CREDENTIALS', 'Username and password are required');
    }

    this.client.debug('Accessing main page to initialize session...');
    // First, access the main page to initialize cookies
    await this.client.get(`/content.aspx?page_id=0&club_id=${this.client.getClubId()}`);

    // Access the login page
    this.client.debug('Accessing login page...');
    const loginPageUrl = `/content.aspx?page_id=31&club_id=${this.client.getClubId()}`;
    const loginPageResponse = await this.client.get(loginPageUrl);
    const $ = cheerio.load(loginPageResponse.data);

    // Extract all hidden form fields
    const hiddenFields: Record<string, string> = {};
    $('input[type="hidden"]').each((_, element) => {
      const name = $(element).attr('name');
      const value = $(element).attr('value') || '';
      if (name) {
        this.client.debug(`Found hidden field: ${name.split('$').pop()}`);
        hiddenFields[name] = value;
      }
    });

    // Encode password in Base64 as the site does
    const encodedPassword = Buffer.from(password).toString('base64');
    this.client.debug('Password encoded');

    // Prepare the login payload with all necessary fields
    const loginPayload: Record<string, string> = {
      ...hiddenFields,
      'ctl00$ctl00$login_name': username,
      'ctl00$ctl00$hiddenPassword': encodedPassword,
      'ctl00$ctl00$password': '', // Original password field is left empty
      '__EVENTTARGET': 'ctl00$ctl00$login_button',
      '__EVENTARGUMENT': '',
    };

    // Add remember me checkbox if selected
    if (rememberMe) {
      loginPayload['ctl00$ctl00$remember_user_checkbox'] = 'on';
    }

    // Add dummy field which is present in the form
    loginPayload['ctl00$ctl00$dummy'] = '';
    this.client.debug('Added dummy field');

    // Submit the login form
    this.client.debug('Submitting login form...');
    const loginResponse = await this.client.post(loginPageUrl, loginPayload);

    // Check for login errors in the response
    const loginHtml = cheerio.load(loginResponse.data);
    const errorMessage = loginHtml('.error-message').text().trim();
    if (errorMessage) {
      throw new ClubExpressError('LOGIN_ERROR', `Login failed: ${errorMessage}`);
    }

    // Verify login by checking if we can access the profile page
    this.client.debug('Verifying login by accessing member profile...');
    try {
      const isLoggedIn = await this.validateSession();
      if (!isLoggedIn) {
        throw new ClubExpressError('LOGIN_FAILED', 'Login failed: Could not confirm successful login');
      }
      
      // Set the authentication status in the client
      this.client.setAuthStatus(true);
      
      return true;
    } catch (error) {
      if (error instanceof ClubExpressError) {
        throw error;
      }
      throw new ClubExpressError('LOGIN_FAILED', 'Login failed: Could not confirm successful login');
    }
  }

  /**
   * Validate if the current session is authenticated
   * @returns True if the session is valid
   */
  async validateSession(): Promise<boolean> {
    try {
      // Try to access the profile page which requires authentication
      const profileUrl = `/content.aspx?club_id=${this.client.getClubId()}&module=Member&target=MyProfile`;
      const profileResponse = await this.client.get(profileUrl);
      const $ = cheerio.load(profileResponse.data);

      // Check if there's a login link or form on the page
      const hasLoginLink = $('a:contains("Member Login")').length > 0;
      const hasLoginForm = $('#ctl00_ctl00_login_box').length > 0;

      if (hasLoginLink || hasLoginForm) {
        this.client.debug('Session validation failed: Login link found on profile page');
        this.client.setAuthStatus(false);
        return false;
      }

      // Check for logout link or member-only content
      const hasLogoutLink = $('a:contains("Logout")').length > 0;
      const hasMemberArea = $('.member-area').length > 0 || $('.member-profile').length > 0;
      const hasUserPanel = $('.user-panel').length > 0;

      if (hasLogoutLink || hasMemberArea || hasUserPanel) {
        this.client.debug('Session validation successful: Found member content');
        this.client.setAuthStatus(true);
        return true;
      }

      // If we can't definitively determine the login state, try the dashboard
      const dashboardUrl = `/content.aspx?page_id=2&club_id=${this.client.getClubId()}`;
      const dashboardResponse = await this.client.get(dashboardUrl);
      const dashboard$ = cheerio.load(dashboardResponse.data);

      // Check if there's a login link on the dashboard
      const dashboardHasLoginLink = dashboard$('a:contains("Member Login")').length > 0;
      if (dashboardHasLoginLink) {
        this.client.debug('Session validation failed: Login link found on dashboard');
        this.client.setAuthStatus(false);
        return false;
      }

      // Check for member-only content on the dashboard
      const dashboardHasMemberContent = dashboard$('.member-area').length > 0 || 
                                       dashboard$('.member-profile').length > 0 ||
                                       dashboard$('.user-panel').length > 0;
      
      if (dashboardHasMemberContent) {
        this.client.debug('Session validation successful: Found member content on dashboard');
        this.client.setAuthStatus(true);
        return true;
      }

      this.client.debug('Session validation inconclusive');
      this.client.setAuthStatus(false);
      return false;
    } catch (error) {
      this.client.debug(`Session validation error: ${error}`);
      this.client.setAuthStatus(false);
      return false;
    }
  }

  /**
   * Logout from ClubExpress
   * @returns True if logout was successful
   */
  async logout(): Promise<boolean> {
    try {
      // Access the logout URL
      const logoutUrl = `/content.aspx?page_id=31&club_id=${this.client.getClubId()}&action=logout`;
      await this.client.get(logoutUrl);
      
      // Verify logout by checking if we can access the profile page
      const isStillLoggedIn = await this.validateSession();
      if (isStillLoggedIn) {
        throw new ClubExpressError('LOGOUT_FAILED', 'Logout failed: Still logged in after logout attempt');
      }
      
      // Set the authentication status in the client
      this.client.setAuthStatus(false);
      
      return true;
    } catch (error) {
      if (error instanceof ClubExpressError) {
        throw error;
      }
      throw new ClubExpressError('LOGOUT_FAILED', 'Logout failed: An error occurred during logout');
    }
  }

  /**
   * Check if the user is logged in
   * @returns True if the user is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    return this.validateSession();
  }

  /**
   * Get the current user information
   * @returns User information
   */
  async getCurrentUser(): Promise<any> {
    if (!(await this.isLoggedIn())) {
      throw new ClubExpressError('NOT_LOGGED_IN', 'User is not logged in');
    }

    try {
      // Access the profile page to get user information
      const profileUrl = `/content.aspx?club_id=${this.client.getClubId()}&module=Member&target=MyProfile`;
      const profileResponse = await this.client.get(profileUrl);
      const $ = cheerio.load(profileResponse.data);

      // Extract user information from the profile page
      // This is a placeholder and should be customized based on the actual page structure
      const userInfo = {
        username: $('.user-name').text().trim() || $('.profile-name').text().trim(),
        // Add more user information as needed
      };

      return userInfo;
    } catch (error) {
      throw new ClubExpressError('USER_INFO_FAILED', 'Failed to get user information');
    }
  }
} 