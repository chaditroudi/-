export const asyncHandler = (handler: any) => async (req: any, res: any, next: any) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};
