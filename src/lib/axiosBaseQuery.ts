import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import type { AxiosRequestConfig } from 'axios';
import { ApiRequestError, axiosClient } from './axiosClient';

export type BaseQueryArgs = {
  url: string;
  method?: AxiosRequestConfig['method'];
  data?: unknown;
  params?: Record<string, unknown>;
};

const toRequestError = (error: unknown) =>
  error instanceof ApiRequestError
    ? error
    : new ApiRequestError({ message: error instanceof Error ? error.message : 'Unexpected error' });

// RTK Query base query that delegates every request through the shared axiosClient.
// The axiosClient already attaches Authorization headers and normalises errors. The
// error keeps its status, so a screen can tell a refusal from a failure.
export const axiosBaseQuery: BaseQueryFn<BaseQueryArgs, unknown, ApiRequestError> = async ({
  url,
  method = 'GET',
  data,
  params,
}) => {
  try {
    const response = await axiosClient.request({ url, method, data, params });
    return { data: response.data };
  } catch (error) {
    return { error: toRequestError(error) };
  }
};
