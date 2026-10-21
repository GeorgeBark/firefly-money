import { beforeEach, describe, expect, it } from 'vitest';
import { logoDomain, logoImg, setLogoSite } from '../app/src/core/logo';

beforeEach(() => localStorage.clear());

describe('logoDomain', () => {
  it('guesses the website from the name', () => {
    expect(logoDomain('Walmart')).toBe('walmart.com');
    expect(logoDomain('WALMART #1234')).toBe('walmart.com');
    expect(logoDomain('SQ *BEAN THERE COFFEE')).toBe('beantherecoffee.com');
    expect(logoDomain('Big Box Store')).toBe('bigbox.com');
    expect(logoDomain('Netflix.com')).toBe('netflix.com');
  });
  it('knows banks and brands whose website differs from the name', () => {
    expect(logoDomain('Chase Freedom Unlimited')).toBe('chase.com');
    expect(logoDomain('Bank of America Checking')).toBe('bankofamerica.com');
    expect(logoDomain('AMZN Mktp US*2K4')).toBe('amazon.com');
    expect(logoDomain('Whole Foods Market')).toBe('wholefoodsmarket.com');
  });
  it('gives up on long descriptions and bare numbers', () => {
    expect(logoDomain('Transfer to savings for the trip in May')).toBe('');
    expect(logoDomain('12345')).toBe('');
  });
  it('uses a website set by hand, including none', () => {
    setLogoSite('Corner Market', 'cornermarket.example.org');
    expect(logoDomain('corner market')).toBe('cornermarket.example.org');
    setLogoSite('Corner Market', '');
    expect(logoDomain('Corner Market')).toBe('');
    expect(logoImg('Corner Market')).toBe('');
    setLogoSite('Corner Shop', 'cornermarket.com', 'Corner Market');
    expect(logoDomain('Corner Market')).toBe('cornermarket.com');
    expect(JSON.parse(localStorage.getItem('money.logoSites')!)).toEqual({ 'corner shop': 'cornermarket.com' });
  });
  it('can be turned off', () => {
    expect(String(logoImg('Walmart'))).toContain('src="logo/walmart.com"');
    localStorage.setItem('money.logos', 'false');
    expect(logoImg('Walmart')).toBe('');
  });
});
