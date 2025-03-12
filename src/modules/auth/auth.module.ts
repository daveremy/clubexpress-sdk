import { ClubExpressClient } from '../../core/client';
import { ClubExpressError } from '../../core/types';
import { LoginCredentials, LoginResponse, LogoutResponse, UserInfo } from './types';

/**
 * Authentication module for ClubExpress
 * Handles login, logout, and session management
 */
export class AuthModule {
  private client: ClubExpressClient;
  private currentUser: UserInfo | null = null;

  /**
   * Create a new authentication module
   * @param client ClubExpress client instance
   */
  constructor(client: ClubExpressClient) {
    this.client = client;
  }

  /**
   * Log in to ClubExpress
   * @param credentials Login credentials
   * @returns Login response
   */
  public async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      // First, get the login page to extract any necessary tokens
      const loginPageUrl = `/clubs/${this.client.getClubId()}/login.aspx`;
      const loginPageResponse = await this.client.get<string>(loginPageUrl);
      
      // Parse the login page HTML
      const $ = this.client.parseHtml(loginPageResponse.data);
      
      // Extract form fields and values
      const viewState = $('#__VIEWSTATE').val() as string;
      const viewStateGenerator = $('#__VIEWSTATEGENERATOR').val() as string;
      const eventValidation = $('#__EVENTVALIDATION').val() as string;
      
      if (!viewState || !viewStateGenerator || !eventValidation) {
        throw new ClubExpressError('Failed to extract form fields from login page', {
          code: 'LOGIN_FORM_EXTRACTION_FAILED',
        });
      }
      
      // Prepare login form data
      const formData = new URLSearchParams();
      formData.append('__VIEWSTATE', viewState);
      formData.append('__VIEWSTATEGENERATOR', viewStateGenerator);
      formData.append('__EVENTVALIDATION', eventValidation);
      formData.append('ctl01$ContentPlaceHolder1$Login1$UserName', credentials.username);
      formData.append('ctl01$ContentPlaceHolder1$Login1$Password', credentials.password);
      formData.append('ctl01$ContentPlaceHolder1$Login1$LoginButton', 'Log In');
      
      // Submit login form
      const loginResponse = await this.client.post<string>(
        loginPageUrl,
        formData.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': `${this.client.getClubId()}/login.aspx`,
          },
        }
      );
      
      // Check if login was successful
      const loginHtml = this.client.parseHtml(loginResponse.data);
      const errorMessage = loginHtml('#ctl01_ContentPlaceHolder1_Login1_FailureText').text().trim();
      
      if (errorMessage) {
        return {
          success: false,
          error: errorMessage,
        };
      }
      
      // Extract user information
      const userName = loginHtml('.user-name').text().trim();
      
      // Set authentication status
      this.client.setAuthStatus(true);
      
      // Set user information
      this.currentUser = {
        name: userName,
      };
      
      return {
        success: true,
        user: this.currentUser,
      };
    } catch (error) {
      if (error instanceof ClubExpressError) {
        throw error;
      }
      
      throw new ClubExpressError('Login failed', {
        code: 'LOGIN_FAILED',
        cause: error as Error,
      });
    }
  }

  /**
   * Log out from ClubExpress
   * @returns Logout response
   */
  public async logout(): Promise<LogoutResponse> {
    try {
      // Get the logout URL
      const logoutUrl = `/clubs/${this.client.getClubId()}/logout.aspx`;
      
      // Send logout request
      await this.client.get<string>(logoutUrl);
      
      // Clear session data
      this.client.clearCookies();
      this.client.setAuthStatus(false);
      this.currentUser = null;
      
      return {
        success: true,
      };
    } catch (error) {
      if (error instanceof ClubExpressError) {
        throw error;
      }
      
      throw new ClubExpressError('Logout failed', {
        code: 'LOGOUT_FAILED',
        cause: error as Error,
      });
    }
  }

  /**
   * Check if the user is logged in
   * @returns True if logged in
   */
  public isLoggedIn(): boolean {
    return this.client.isLoggedIn();
  }

  /**
   * Get the current user information
   * @returns User information or null if not logged in
   */
  public getCurrentUser(): UserInfo | null {
    return this.currentUser;
  }
} 