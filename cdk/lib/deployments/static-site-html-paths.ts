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
  prune: boolean,
}

/*
 * Copy all the files representing rendered HTML paths to the static site bucket, setting a text/html content type
 */
export class StaticSiteHtmlPathsDeployment extends BucketDeployment {
  constructor(scope: Construct, {
    instance,
    buckets,
    distributions,
  }: StaticSiteDeploymentProps) {
    super(scope, "DeployStaticSiteHtmlPaths", {
      sources: [
        Source.asset("../dist"),
      ],
      destinationBucket: buckets.staticSite,
      distribution: distributions.primary,
      contentType: "text/html",
      exclude: [ "*.*" ], // Exclude any file with a .
    });
  }
}
