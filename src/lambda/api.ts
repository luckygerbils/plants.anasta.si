import { LambdaFunctionURLEvent, LambdaFunctionURLHandler, LambdaFunctionURLResult } from 'aws-lambda';

const DATA_BUCKET: string = process.env.DATA_BUCKET ?? 
  (() => { throw new Error("Environment variable DATA_BUCKET not set"); })();

export const handler: LambdaFunctionURLHandler = async (event: LambdaFunctionURLEvent): Promise<LambdaFunctionURLResult> => {
  const operation = event.rawPath.replace(/^\/api\//, "");
  const input = event.body;

  const output = {
    DATA_BUCKET
  };

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(output ?? {}),
  };
}
