import { describe, it, expect } from 'vitest';
import { JourneyRunner } from '../../src/core/journey-runner.js';
import type { JourneysConfig } from '../../src/types/index.js';

const sampleJourneys: JourneysConfig = {
  login: {
    description: 'User login flow',
    mode: 'guided',
    steps: [
      { action: 'navigate', target: '/login' },
      { action: 'fill', target: '#email', value: 'user@test.com' },
      { action: 'fill', target: '#password', value: 'pass123' },
      { action: 'click', target: 'button[type=submit]', expect: 'URL changes to /dashboard' },
    ],
  },
  checkout: {
    description: 'Checkout flow',
    auth: 'buyer',
    dependsOn: ['login'],
    mode: 'guided',
    steps: [
      { action: 'navigate', target: '/cart' },
      { action: 'click', target: '.checkout-btn' },
      { action: 'fill', target: '#card', value: '4242...' },
      { action: 'click', target: '#pay', expect: 'Order confirmation shown' },
    ],
  },
  explore: {
    description: 'Explore pages autonomously',
    mode: 'autonomous',
    steps: [
      { action: 'navigate', target: '/products', note: 'Browse products catalog' },
      { action: 'navigate', target: '/about', note: 'Check about page' },
    ],
  },
};

describe('JourneyRunner', () => {
  it('lists all journeys with descriptions and status', () => {
    const runner = new JourneyRunner(sampleJourneys);
    const list = runner.listJourneys();
    expect(list).toHaveLength(3);
    expect(list[0].name).toBe('login');
    expect(list[0].description).toBe('User login flow');
    expect(list[0].status).toBe('pending');
    expect(list[0].stepCount).toBe(4);
  });

  it('gets a specific journey definition', () => {
    const runner = new JourneyRunner(sampleJourneys);
    const journey = runner.getJourney('login');
    expect(journey).not.toBeNull();
    expect(journey!.steps).toHaveLength(4);
    expect(journey!.mode).toBe('guided');
  });

  it('returns null for unknown journey', () => {
    const runner = new JourneyRunner(sampleJourneys);
    expect(runner.getJourney('unknown')).toBeNull();
  });

  it('tracks journey status', () => {
    const runner = new JourneyRunner(sampleJourneys);
    const status = runner.getStatus();
    expect(status).toHaveLength(3);
    expect(status.every((s) => s.status === 'pending')).toBe(true);
  });

  it('starts a journey', () => {
    const runner = new JourneyRunner(sampleJourneys);
    runner.startJourney('login');
    const state = runner.getState('login');
    expect(state!.status).toBe('in_progress');
    expect(state!.currentStep).toBe(0);
    expect(state!.startedAt).toBeDefined();
  });

  it('advances steps through a journey', () => {
    const runner = new JourneyRunner(sampleJourneys);
    runner.startJourney('login');

    runner.advanceStep('login');
    expect(runner.getState('login')!.currentStep).toBe(1);

    runner.advanceStep('login');
    expect(runner.getState('login')!.currentStep).toBe(2);

    runner.advanceStep('login');
    expect(runner.getState('login')!.currentStep).toBe(3);

    // Last advance completes the journey
    runner.advanceStep('login');
    expect(runner.getState('login')!.status).toBe('completed');
    expect(runner.getState('login')!.completedAt).toBeDefined();
  });

  it('enforces dependencies', () => {
    const runner = new JourneyRunner(sampleJourneys);
    expect(() => runner.startJourney('checkout')).toThrow('depends on "login" which is pending');
  });

  it('allows starting dependent journey after dependency completes', () => {
    const runner = new JourneyRunner(sampleJourneys);
    runner.startJourney('login');
    runner.completeJourney('login');
    expect(() => runner.startJourney('checkout')).not.toThrow();
    expect(runner.getState('checkout')!.status).toBe('in_progress');
  });

  it('fails a journey with error', () => {
    const runner = new JourneyRunner(sampleJourneys);
    runner.startJourney('login');
    runner.failJourney('login', 'Element not found');
    expect(runner.getState('login')!.status).toBe('failed');
    expect(runner.getState('login')!.error).toBe('Element not found');
  });

  it('computes execution order respecting dependencies', () => {
    const runner = new JourneyRunner(sampleJourneys);
    const order = runner.getExecutionOrder();
    const loginIdx = order.indexOf('login');
    const checkoutIdx = order.indexOf('checkout');
    expect(loginIdx).toBeLessThan(checkoutIdx);
    expect(order).toContain('explore');
  });

  it('detects circular dependencies', () => {
    const circular: JourneysConfig = {
      a: { description: 'A', mode: 'guided', dependsOn: ['b'], steps: [{ action: 'navigate' }] },
      b: { description: 'B', mode: 'guided', dependsOn: ['a'], steps: [{ action: 'navigate' }] },
    };
    const runner = new JourneyRunner(circular);
    expect(() => runner.getExecutionOrder()).toThrow('Circular dependency');
  });

  it('throws on unknown journey operations', () => {
    const runner = new JourneyRunner(sampleJourneys);
    expect(() => runner.startJourney('nonexistent')).toThrow('not found');
    expect(() => runner.advanceStep('nonexistent')).toThrow('not found');
    expect(() => runner.completeJourney('nonexistent')).toThrow('not found');
    expect(() => runner.failJourney('nonexistent', 'err')).toThrow('not found');
  });

  it('throws when advancing a non-in-progress journey', () => {
    const runner = new JourneyRunner(sampleJourneys);
    expect(() => runner.advanceStep('login')).toThrow('not in progress');
  });
});
