import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ClubExpressError } from './error';
import * as cheerio from 'cheerio';
import { ClientConfig, RequestOptions, HttpResponse } from './types';

/**
 * ClubExpress HTTP client
 * Handles all HTTP communication with the ClubExpress platform
 */
export class ClubExpressClient {
  private axiosInstance: AxiosInstance;
  private baseUrl: string;
  private clubId: string;
  private cookies: Record<string, string> = {};
  private isAuthenticated: boolean = false;
  private debugEnabled: boolean = false;

  /**
   * Create a new ClubExpress client
   * @param clubId The ClubExpress club ID
   * @param baseUrl The base URL for the ClubExpress site (default: https://spa.clubexpress.com)
   * @param debug Whether to enable debug logging (default: false)
   */
  constructor(clubId: string, baseUrl: string = 'https://spa.clubexpress.com', debug: boolean = false) {
    this.clubId = clubId;
    this.baseUrl = baseUrl;
    this.debugEnabled = debug;

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      withCredentials: true,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    // Add request interceptor to include cookies
    this.axiosInstance.interceptors.request.use((config) => {
      if (Object.keys(this.cookies).length > 0) {
        const cookieString = Object.entries(this.cookies)
          .map(([name, value]) => `${name}=${value}`)
          .join('; ');
        
        config.headers['Cookie'] = cookieString;
        if (this.debugEnabled) {
          this.debug(`Request cookies: ${cookieString}`);
        }
      }
      return config;
    });

    // Add response interceptor to extract cookies
    this.axiosInstance.interceptors.response.use((response) => {
      this.extractCookies(response);
      return response;
    });
  }

  /**
   * Extract cookies from response headers and store them
   * @param response The Axios response
   */
  private extractCookies(response: AxiosResponse): void {
    const setCookieHeader = response.headers['set-cookie'];
    if (setCookieHeader) {
      if (this.debugEnabled) {
        this.debug(`Set-Cookie header found: ${JSON.stringify(setCookieHeader)}`);
      }

      // Handle both array and string cookie headers
      const cookieHeaders = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
      
      cookieHeaders.forEach(cookieStr => {
        // Extract the cookie name and value (ignoring attributes like path, expires, etc.)
        const match = cookieStr.match(/^([^=]+)=([^;]+)/);
        if (match) {
          const [, name, value] = match;
          this.cookies[name] = value;
        }
      });

      if (this.debugEnabled) {
        this.debug(`Cookies after extraction: ${JSON.stringify(this.cookies)}`);
      }
    }
  }

  /**
   * Make a GET request
   * @param url The URL to request
   * @param config Optional Axios request config
   * @returns The Axios response
   */
  async get(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    try {
      this.debug(`Request: GET ${url}`);
      const response = await this.axiosInstance.get(url, config);
      this.debug(`Response: ${response.status} ${response.statusText}`);
      this.debug(`Response headers: ${JSON.stringify(response.headers)}`);
      return response;
    } catch (error: any) {
      this.handleRequestError(error, 'GET', url);
      throw error;
    }
  }

  /**
   * Make a POST request
   * @param url The URL to request
   * @param data The data to send
   * @param config Optional Axios request config
   * @returns The Axios response
   */
  async post(url: string, data: any, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    try {
      this.debug(`Request: POST ${url}`);
      if (this.debugEnabled) {
        this.debug(`Request data: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
      }
      
      // If data is an object but not FormData, URLSearchParams, or a string,
      // convert it to x-www-form-urlencoded format
      let requestData = data;
      let requestConfig = config || {};
      
      if (typeof data === 'object' && 
          !(data instanceof FormData) && 
          !(data instanceof URLSearchParams) &&
          !(typeof data === 'string')) {
        
        requestData = new URLSearchParams();
        for (const [key, value] of Object.entries(data)) {
          requestData.append(key, value as string);
        }
        requestData = requestData.toString();
        
        // Set the content type if not already set
        if (!requestConfig.headers) {
          requestConfig.headers = {};
        }
        if (!requestConfig.headers['Content-Type']) {
          requestConfig.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      }
      
      const response = await this.axiosInstance.post(url, requestData, requestConfig);
      this.debug(`Response: ${response.status} ${response.statusText}`);
      this.debug(`Response headers: ${JSON.stringify(response.headers)}`);
      return response;
    } catch (error: any) {
      this.handleRequestError(error, 'POST', url);
      throw error;
    }
  }

  /**
   * Handle request errors
   * @param error The error object
   * @param method The HTTP method
   * @param url The URL
   */
  private handleRequestError(error: any, method: string, url: string): void {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      this.debug(`Error ${method} ${url}: ${error.response.status} ${error.response.statusText}`);
      throw new ClubExpressError(
        'REQUEST_FAILED',
        `Request failed with status ${error.response.status}`,
        { status: error.response.status }
      );
    } else if (error.request) {
      // The request was made but no response was received
      this.debug(`Error ${method} ${url}: No response received`);
      throw new ClubExpressError(
        'NO_RESPONSE',
        'No response received from server'
      );
    } else {
      // Something happened in setting up the request that triggered an Error
      this.debug(`Error ${method} ${url}: ${error.message}`);
      throw new ClubExpressError(
        'REQUEST_SETUP_ERROR',
        `Request setup error: ${error.message}`
      );
    }
  }

  /**
   * Set the authentication status
   * @param status The authentication status
   */
  setAuthStatus(status: boolean): void {
    this.isAuthenticated = status;
  }

  /**
   * Get the authentication status
   * @returns The authentication status
   */
  getAuthStatus(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Get the club ID
   * @returns The club ID
   */
  getClubId(): string {
    return this.clubId;
  }

  /**
   * Get the base URL
   * @returns The base URL
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Clear all cookies
   */
  clearCookies(): void {
    this.cookies = {};
    this.debug('Cookies cleared');
  }

  /**
   * Get all cookies
   * @returns The cookies
   */
  getCookies(): Record<string, string> {
    return { ...this.cookies };
  }

  /**
   * Log a debug message
   * @param message The message to log
   */
  debug(message: string): void {
    if (this.debugEnabled) {
      console.log(`Debug: ${message}`);
    }
  }

  /**
   * Parse HTML response using Cheerio
   * @param html HTML string to parse
   * @returns Cheerio instance
   */
  public parseHtml(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }
} 