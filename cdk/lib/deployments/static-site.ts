import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { AppInstance } from "../instances";

interface StaticSiteDeploymentProps {
  instance: AppInstance,
  buckets: {
    staticSite: IBucket,
  },
}

export class StaticSiteDeployment extends BucketDeployment {
  constructor(scope: Construct, {
    instance,
    buckets,
  }: StaticSiteDeploymentProps) {
    super(scope, "DeployStaticSite", {
      sources: [
        Source.asset("../dist"),
      ],
      destinationBucket: buckets.staticSite,
    });
  }
}
