import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { ClientConfig, RequestOptions, HttpResponse, ClubExpressError } from './types';

/**
 * ClubExpress HTTP client
 * Handles all HTTP communication with the ClubExpress platform
 */
export class ClubExpressClient {
  private client: AxiosInstance;
  private config: Required<ClientConfig>;
  private cookies: Record<string, string> = {};
  private isAuthenticated = false;

  /**
   * Default configuration values
   */
  private static readonly DEFAULT_CONFIG: Required<ClientConfig> = {
    baseUrl: 'https://www.clubexpress.com',
    clubId: '',
    debug: false,
    timeout: 30000,
    maxRetries: 3,
  };

  /**
   * Create a new ClubExpress client
   * @param config Client configuration
   */
  constructor(config: ClientConfig = {}) {
    // Merge provided config with defaults
    this.config = {
      ...ClubExpressClient.DEFAULT_CONFIG,
      ...config,
    };

    // Create axios instance
    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      withCredentials: true,
      headers: {
        'User-Agent': 'ClubExpress-SDK/0.1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    // Add request interceptor to include cookies
    this.client.interceptors.request.use((config) => {
      if (Object.keys(this.cookies).length > 0) {
        const cookieString = Object.entries(this.cookies)
          .map(([key, value]) => `${key}=${value}`)
          .join('; ');
        
        config.headers.Cookie = cookieString;
      }
      
      if (this.config.debug) {
        console.log(`Request: ${config.method?.toUpperCase()} ${config.url}`);
        if (config.data) {
          console.log('Request data:', config.data);
        }
      }
      
      return config;
    });

    // Add response interceptor to extract cookies and handle errors
    this.client.interceptors.response.use(
      (response) => {
        this.extractCookies(response);
        
        if (this.config.debug) {
          console.log(`Response: ${response.status} ${response.statusText}`);
          console.log('Response headers:', response.headers);
        }
        
        return response;
      },
      async (error) => {
        if (this.config.debug) {
          console.error('Request error:', error.message);
          if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
          }
        }
        
        // Handle retry logic
        const config = error.config;
        if (!config || !config.retry) {
          config.retry = 0;
        }
        
        if (config.retry < this.config.maxRetries) {
          config.retry += 1;
          
          if (this.config.debug) {
            console.log(`Retrying request (${config.retry}/${this.config.maxRetries})...`);
          }
          
          // Exponential backoff
          const delay = Math.pow(2, config.retry) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          
          return this.client(config);
        }
        
        // Convert to SDK error
        throw new ClubExpressError(
          error.message || 'Request failed',
          {
            status: error.response?.status,
            code: 'REQUEST_FAILED',
            cause: error,
          }
        );
      }
    );
  }

  /**
   * Extract cookies from response headers
   * @param response Axios response
   */
  private extractCookies(response: AxiosResponse): void {
    const setCookieHeader = response.headers['set-cookie'];
    
    if (!setCookieHeader) {
      return;
    }
    
    // Process cookies
    const processCookie = (cookieString: string): void => {
      const cookieParts = cookieString.split(';');
      if (cookieParts.length > 0) {
        const mainPart = cookieParts[0];
        const keyValueParts = mainPart.split('=');
        
        if (keyValueParts.length === 2) {
          const key = keyValueParts[0].trim();
          const value = keyValueParts[1].trim();
          
          if (key && value) {
            this.cookies[key] = value;
          }
        }
      }
    };
    
    // Handle array of cookies or single cookie string
    if (Array.isArray(setCookieHeader)) {
      setCookieHeader.forEach(processCookie);
    } else if (typeof setCookieHeader === 'string') {
      processCookie(setCookieHeader);
    }
  }

  /**
   * Make a GET request
   * @param url Request URL
   * @param options Request options
   * @returns HTTP response
   */
  public async get<T = any>(url: string, options: RequestOptions = {}): Promise<HttpResponse<T>> {
    const config: AxiosRequestConfig = {
      params: options.params,
      headers: options.headers,
      timeout: options.timeout || this.config.timeout,
      withCredentials: options.withCredentials !== false,
    };
    
    const response = await this.client.get<T>(url, config);
    
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
    };
  }

  /**
   * Make a POST request
   * @param url Request URL
   * @param data Request body
   * @param options Request options
   * @returns HTTP response
   */
  public async post<T = any>(
    url: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<HttpResponse<T>> {
    const config: AxiosRequestConfig = {
      params: options.params,
      headers: options.headers,
      timeout: options.timeout || this.config.timeout,
      withCredentials: options.withCredentials !== false,
    };
    
    const response = await this.client.post<T>(url, data, config);
    
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
    };
  }

  /**
   * Parse HTML response using Cheerio
   * @param html HTML string to parse
   * @returns Cheerio instance
   */
  public parseHtml(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }

  /**
   * Get the club ID
   * @returns Club ID
   */
  public getClubId(): string {
    return this.config.clubId;
  }

  /**
   * Set the club ID
   * @param clubId Club ID
   */
  public setClubId(clubId: string): void {
    this.config.clubId = clubId;
  }

  /**
   * Check if the client is authenticated
   * @returns True if authenticated
   */
  public isLoggedIn(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Set the authentication status
   * @param status Authentication status
   */
  public setAuthStatus(status: boolean): void {
    this.isAuthenticated = status;
  }

  /**
   * Clear all cookies
   */
  public clearCookies(): void {
    this.cookies = {};
  }
} 