import { Duration } from "aws-cdk-lib";
import { IRole } from "aws-cdk-lib/aws-iam";
import { Code, Function, FunctionUrl, FunctionUrlAuthType, Runtime } from "aws-cdk-lib/aws-lambda";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

interface ApiFunctionProps {
  buckets: {
    data: Bucket,
  },
  roles: {
    api: IRole,
    editor: IRole,
  }
}

export class ApiFunction extends Function {
  readonly url: FunctionUrl;
  constructor(scope: Construct, {
    buckets,
    roles,
  }: ApiFunctionProps) {
    super(scope, "ApiFunction", {
      runtime: Runtime.NODEJS_20_X,
      handler: "lambda/api.handler",
      code: Code.fromAsset("../dist/lambda"),
      role: roles.api,
      environment: {
        DATA_BUCKET: buckets.data.bucketName,
        NODE_OPTIONS: '--enable-source-maps'
      },
      timeout: Duration.seconds(30),
      memorySize: 512,
    });

    this.url = this.addFunctionUrl({
      authType: FunctionUrlAuthType.AWS_IAM,
    });

    this.grantInvokeUrl(roles.editor);
  }
}