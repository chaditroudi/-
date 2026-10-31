import { describe, expect, it } from 'vitest';

import { classifyFailure, failureMessage, shouldRetryQuery } from './apiErrors';
import { ApiRequestError } from './axiosClient';

const failure = (status: number | null, isNetworkError = false) =>
  new ApiRequestError({ message: 'x', status, isNetworkError });

describe('classifyFailure', () => {
  it.each([
    [403, 'restricted'],
    [401, 'session'],
    [404, 'notFound'],
    [409, 'invalid'],
    [422, 'invalid'],
    [500, 'server'],
    [503, 'server'],
  ])('reads %i as %s', (status, kind) => {
    expect(classifyFailure(failure(status))).toBe(kind);
  });

  it('tells a lost connection from a failing server', () => {
    expect(classifyFailure(failure(null, true), false)).toBe('offline');
    expect(classifyFailure(failure(null, true), true)).toBe('server');
  });

  it('never reads an unknown failure as a success', () => {
    expect(classifyFailure(new Error('boom'))).toBe('server');
    expect(classifyFailure('boom')).toBe('server');
  });
});

describe('shouldRetryQuery', () => {
  it('does not repeat a refusal', () => {
    expect(shouldRetryQuery(0, failure(403))).toBe(false);
    expect(shouldRetryQuery(0, failure(401))).toBe(false);
    expect(shouldRetryQuery(0, failure(404))).toBe(false);
  });

  it('tries a failing server once more', () => {
    expect(shouldRetryQuery(0, failure(500))).toBe(true);
    expect(shouldRetryQuery(1, failure(500))).toBe(false);
  });
});

describe('failureMessage', () => {
  it('keeps a reason written for employees', () => {
    expect(failureMessage(new Error('Le lot est bloqué.'), 'Refusé')).toBe('Le lot est bloqué.');
    expect(failureMessage('Le lot est bloqué.', 'Refusé')).toBe('Le lot est bloqué.');
  });

  it('replaces technical English', () => {
    expect(failureMessage(new Error('Request failed: 500'), 'Refusé')).toBe('Refusé');
    expect(failureMessage(new Error('You do not have permission to perform this action.'), 'Refusé')).toBe('Refusé');
    expect(failureMessage(new Error('MongoDB Atlas is not connected yet.'), 'Refusé')).toBe('Refusé');
  });
});
