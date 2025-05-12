import { RemovalPolicy } from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class StaticSiteBucket extends Bucket {
  constructor(scope: Construct) {
    super(scope, "StaticSiteBucket", {
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}