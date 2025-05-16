import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { AppInstance } from "../instances";
import { Distribution } from "aws-cdk-lib/aws-logs";
import { IDistribution } from "aws-cdk-lib/aws-cloudfront";

interface StaticSiteDeploymentProps {
  instance: AppInstance,
  buckets: {
    staticSite: IBucket,
  },
  distributions: {
    primary: IDistribution,
  },
}

export class StaticSiteDeployment extends BucketDeployment {
  constructor(scope: Construct, {
    instance,
    buckets,
    distributions,
  }: StaticSiteDeploymentProps) {
    super(scope, "DeployStaticSite", {
      sources: [
        Source.asset(`../dist/website/${instance.name}`),
      ],
      destinationBucket: buckets.staticSite,
      distribution: distributions.primary,
      exclude: ["*"],
      include: ["*.*"], // Include only files with a .
    });
  }
}
