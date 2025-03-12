/**
 * Configuration options for the ClubExpress client
 */
export interface ClientConfig {
  /**
   * The ClubExpress club ID
   */
  clubId?: string;
  
  /**
   * Base URL for ClubExpress API
   * @default 'https://www.clubexpress.com'
   */
  baseUrl?: string;
  
  /**
   * Enable debug mode for verbose logging
   * @default false
   */
  debug?: boolean;
  
  /**
   * Request timeout in milliseconds
   * @default 30000
   */
  timeout?: number;
  
  /**
   * Maximum number of retries for failed requests
   * @default 3
   */
  maxRetries?: number;
}

/**
 * HTTP request options
 */
export interface RequestOptions {
  /**
   * HTTP headers to include with the request
   */
  headers?: Record<string, string>;
  
  /**
   * Query parameters to include with the request
   */
  params?: Record<string, string | number | boolean>;
  
  /**
   * Request timeout in milliseconds
   */
  timeout?: number;
  
  /**
   * Whether to include cookies with the request
   * @default true
   */
  withCredentials?: boolean;
}

/**
 * HTTP response interface
 */
export interface HttpResponse<T = any> {
  /**
   * Response data
   */
  data: T;
  
  /**
   * HTTP status code
   */
  status: number;
  
  /**
   * HTTP status text
   */
  statusText: string;
  
  /**
   * Response headers
   */
  headers: Record<string, string>;
}

/**
 * Error response from the ClubExpress API
 */
export interface ApiError {
  /**
   * Error message
   */
  message: string;
  
  /**
   * Error code
   */
  code?: string;
  
  /**
   * Additional error details
   */
  details?: Record<string, any>;
}

/**
 * SDK error class
 */
export class ClubExpressError extends Error {
  /**
   * HTTP status code if applicable
   */
  status?: number;
  
  /**
   * Error code
   */
  code?: string;
  
  /**
   * Original error that caused this error
   */
  cause?: Error;
  
  constructor(message: string, options?: { status?: number; code?: string; cause?: Error }) {
    super(message);
    this.name = 'ClubExpressError';
    this.status = options?.status;
    this.code = options?.code;
    this.cause = options?.cause;
  }
} 