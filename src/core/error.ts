/**
 * Custom error class for ClubExpress SDK
 */
export class ClubExpressError extends Error {
  /**
   * Error code
   */
  public code: string;

  /**
   * Additional error details
   */
  public details?: any;

  /**
   * Create a new ClubExpressError
   * @param code Error code
   * @param message Error message
   * @param details Additional error details
   */
  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'ClubExpressError';
    this.code = code;
    this.details = details;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, ClubExpressError.prototype);
  }
} 