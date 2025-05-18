import { BucketDeployment, CacheControl, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { IDistribution } from "aws-cdk-lib/aws-cloudfront";
import { Duration } from "aws-cdk-lib";
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

/*
 * Copy all the static asset files that have content hashes to the static site bucket,
 * setting long-lived cache-control headers on them
 */
export class StaticSiteHashedAssetsDeployment extends BucketDeployment {
  constructor(scope: Construct, {
    instance,
    buckets,
    distributions,
  }: StaticSiteDeploymentProps) {
    super(scope, "DeployStaticSiteHashedAssets", {
      sources: [ Source.asset(`../dist/website/${instance.name}`) ],
      destinationBucket: buckets.staticSite,
      distribution: distributions.primary,

      // Hashed assets have names like {name}.{hash}.{extension}
      exclude: [ "*" ],
      include: ["*.*.*"],

      cacheControl: [
        CacheControl.setPublic(),
        CacheControl.maxAge(Duration.days(365)),
        CacheControl.immutable(),
      ]
    });
  }
}
