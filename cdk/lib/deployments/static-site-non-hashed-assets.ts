import { BucketDeployment, ISource } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { IDistribution } from "aws-cdk-lib/aws-cloudfront";
import { basename } from "node:path";

interface StaticSiteDeploymentProps {
  source: (filterFn: (path: string) => boolean) => ISource,
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
    source,
    buckets,
    distributions,
  }: StaticSiteDeploymentProps) {
    super(scope, "DeployStaticSiteNonHashedAssets", {
      // Non-hashed assets have names like {name}.{extension}
      sources: [ source(path => /^[^.]*\.[^.]*$/.test(basename(path))) ],
      destinationBucket: buckets.staticSite,
      distribution: distributions.primary,
    });
  }
}
