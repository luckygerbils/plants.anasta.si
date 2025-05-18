import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { IDistribution } from "aws-cdk-lib/aws-cloudfront";
import { AppInstance } from "../instances";

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
export class StaticSiteNonHashedAssetsDeployment extends BucketDeployment {
  constructor(scope: Construct, {
    instance,
    buckets,
    distributions,
  }: StaticSiteDeploymentProps) {
    super(scope, "DeployStaticSiteNonHashedAssets", {
      sources: [ Source.asset(`../dist/website/${instance.name}`) ],
      destinationBucket: buckets.staticSite,
      distribution: distributions.primary,
      exclude: [ "*" ],
      // Non-hashed, non-html path assets should be a limited list we can hard-code
      include: [ "favicon.ico", "index.html" ]
    });
  }
}
