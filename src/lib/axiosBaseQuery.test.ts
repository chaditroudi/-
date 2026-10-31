import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosBaseQuery } from './axiosBaseQuery';
import { ApiRequestError, axiosClient } from './axiosClient';

const run = (url = '/stock/lots') => axiosBaseQuery({ url }, {} as never, undefined);

afterEach(() => vi.restoreAllMocks());

describe('axiosBaseQuery', () => {
  it('keeps the status of a refusal, so 403 cannot become an empty list', async () => {
    const refused = new ApiRequestError({ message: 'Refusé', status: 403, code: 'FORBIDDEN' });
    vi.spyOn(axiosClient, 'request').mockRejectedValue(refused);

    const result = await run();

    expect(result.data).toBeUndefined();
    expect(result.error).toBe(refused);
    expect(result.error?.status).toBe(403);
  });

  it('keeps a server failure as a failure', async () => {
    vi.spyOn(axiosClient, 'request').mockRejectedValue(new ApiRequestError({ message: 'x', status: 500 }));
    expect((await run()).error?.status).toBe(500);
  });

  it('marks anything unexpected as an error too', async () => {
    vi.spyOn(axiosClient, 'request').mockRejectedValue(new Error('boom'));
    const { error } = await run();
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error?.message).toBe('boom');
  });

  it('passes data through', async () => {
    vi.spyOn(axiosClient, 'request').mockResolvedValue({ data: { data: [] } });
    expect(await run()).toEqual({ data: { data: [] } });
  });
});
