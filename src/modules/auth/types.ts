/**
 * Login credentials for ClubExpress
 */
export interface LoginCredentials {
  /**
   * Username or email address
   */
  username: string;
  
  /**
   * Password
   */
  password: string;
}

/**
 * Login response
 */
export interface LoginResponse {
  /**
   * Whether the login was successful
   */
  success: boolean;
  
  /**
   * Error message if login failed
   */
  error?: string;
  
  /**
   * User information if login was successful
   */
  user?: UserInfo;
}

/**
 * User information
 */
export interface UserInfo {
  /**
   * User ID
   */
  id?: string;
  
  /**
   * User's full name
   */
  name?: string;
  
  /**
   * User's email address
   */
  email?: string;
  
  /**
   * User's membership status
   */
  membershipStatus?: string;
}

/**
 * Logout response
 */
export interface LogoutResponse {
  /**
   * Whether the logout was successful
   */
  success: boolean;
  
  /**
   * Error message if logout failed
   */
  error?: string;
} 