import axios from 'axios';
import { ClubExpressClient } from '../../src/core/client';
import { ClubExpressError } from '../../src/core/types';

// Mock axios
jest.mock('axios', () => {
  return {
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    })),
  };
});

describe('ClubExpressClient', () => {
  let client: ClubExpressClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new ClubExpressClient({
      clubId: '123456',
      debug: false,
    });
    mockAxiosInstance = (axios.create as jest.Mock).mock.results[0].value;
  });

  describe('constructor', () => {
    it('should create an instance with default config', () => {
      const client = new ClubExpressClient();
      expect(client).toBeDefined();
      expect(axios.create).toHaveBeenCalled();
    });

    it('should create an instance with custom config', () => {
      const client = new ClubExpressClient({
        baseUrl: 'https://custom.clubexpress.com',
        clubId: '123456',
        timeout: 5000,
        debug: true,
      });
      expect(client).toBeDefined();
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://custom.clubexpress.com',
          timeout: 5000,
        })
      );
    });
  });

  describe('get', () => {
    it('should make a GET request', async () => {
      const mockResponse = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      };
      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const response = await client.get('/test');
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test', expect.any(Object));
      expect(response).toEqual({
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      });
    });

    it('should make a GET request with options', async () => {
      const mockResponse = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      };
      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const response = await client.get('/test', {
        params: { foo: 'bar' },
        headers: { 'X-Test': 'test' },
      });
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test', {
        params: { foo: 'bar' },
        headers: { 'X-Test': 'test' },
        timeout: 30000,
        withCredentials: true,
      });
      expect(response).toEqual({
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      });
    });
  });

  describe('post', () => {
    it('should make a POST request', async () => {
      const mockResponse = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      };
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const response = await client.post('/test', { foo: 'bar' });
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test', { foo: 'bar' }, expect.any(Object));
      expect(response).toEqual({
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      });
    });

    it('should make a POST request with options', async () => {
      const mockResponse = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      };
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const response = await client.post(
        '/test',
        { foo: 'bar' },
        {
          params: { baz: 'qux' },
          headers: { 'X-Test': 'test' },
        }
      );
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/test',
        { foo: 'bar' },
        {
          params: { baz: 'qux' },
          headers: { 'X-Test': 'test' },
          timeout: 30000,
          withCredentials: true,
        }
      );
      expect(response).toEqual({
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
      });
    });
  });

  describe('club ID methods', () => {
    it('should get and set club ID', () => {
      expect(client.getClubId()).toBe('123456');
      
      client.setClubId('654321');
      expect(client.getClubId()).toBe('654321');
    });
  });

  describe('authentication methods', () => {
    it('should get and set authentication status', () => {
      expect(client.isLoggedIn()).toBe(false);
      
      client.setAuthStatus(true);
      expect(client.isLoggedIn()).toBe(true);
      
      client.setAuthStatus(false);
      expect(client.isLoggedIn()).toBe(false);
    });
  });

  describe('cookie methods', () => {
    it('should clear cookies', () => {
      // This is a bit of a weak test since we can't easily test the private cookies property
      // But at least it ensures the method doesn't throw
      expect(() => client.clearCookies()).not.toThrow();
    });
  });
}); 