import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { AppInstance } from "../instances";
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

/**
 * Copy static site files that aren't either content hashed or represent plain HTML paths
 * These have content type inferred but don't have long-lived cache-control headers added
 */
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

      // Include only files with a single .
      exclude: ["*", "*.*.*"],
      include: ["*.*"],
    });
  }
}
