import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import type { AxiosRequestConfig } from 'axios';
import { axiosClient } from './axiosClient';

export type BaseQueryArgs = {
  url: string;
  method?: AxiosRequestConfig['method'];
  data?: unknown;
  params?: Record<string, unknown>;
};

// RTK Query base query that delegates every request through the shared axiosClient.
// The axiosClient already attaches Authorization headers and normalises errors.
export const axiosBaseQuery: BaseQueryFn<BaseQueryArgs, unknown, string> = async ({
  url,
  method = 'GET',
  data,
  params,
}) => {
  try {
    const response = await axiosClient.request({ url, method, data, params });
    return { data: response.data };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Unexpected error',
    };
  }
};
