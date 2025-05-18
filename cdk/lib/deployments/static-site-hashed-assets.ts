import { BucketDeployment, CacheControl, ISource } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { IDistribution } from "aws-cdk-lib/aws-cloudfront";
import { Duration } from "aws-cdk-lib";
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

/*
 * Copy all the static asset files that have content hashes to the static site bucket,
 * setting long-lived cache-control headers on them
 */
export class StaticSiteHashedAssetsDeployment extends BucketDeployment {
  constructor(scope: Construct, {
    source,
    buckets,
    distributions,
  }: StaticSiteDeploymentProps) {
    super(scope, "DeployStaticSiteHashedAssets", {
      // Non-hashed assets have names like {name}.{hash}.{extension}
      sources: [ source(path => /^[^.]*\.[^.]*\.[^.]*$/.test(basename(path))) ],
      destinationBucket: buckets.staticSite,
      distribution: distributions.primary,

      cacheControl: [
        CacheControl.setPublic(),
        CacheControl.maxAge(Duration.days(365)),
        CacheControl.immutable(),
      ]
    });
  }
}
