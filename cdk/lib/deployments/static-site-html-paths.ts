import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { AppInstance } from "../instances";
import { IDistribution } from "aws-cdk-lib/aws-cloudfront";
import { readFileSync } from "node:fs";
import { EditorIdentityPool } from "../cognito/identity-pools";
import { FunctionUrl } from "aws-cdk-lib/aws-lambda";

interface StaticSiteDeploymentProps {
  instance: AppInstance,
  buckets: {
    staticSite: IBucket,
  },
  distributions: {
    primary: IDistribution,
  },
  lambdas: {
    api: { url: FunctionUrl },
  },
  identityPool: EditorIdentityPool,
}

/*
 * Copy all the files representing rendered HTML paths to the static site bucket, setting a text/html content type
 */
export class StaticSiteHtmlPathsDeployment extends BucketDeployment {
  constructor(scope: Construct, {
    instance,
    buckets,
    distributions,
    lambdas,
    identityPool,
  }: StaticSiteDeploymentProps) {
    super(scope, "DeployStaticSiteHtmlPaths", {
      sources: [
        Source.asset(`../dist/website/${instance.name}`),
        ...["admin/list", "admin/plant", "login"].map(page => Source.data(
          page,
          readFileSync(`../dist/website/${instance.name}/${page}`, { encoding: "utf-8"})
            .replace(/window.props = "{}"/m, 'window.props = ' + JSON.stringify(JSON.stringify({
              userPoolId: identityPool.userPool.userPoolId,
              userPoolClientId: identityPool.userPoolClient.userPoolClientId,
              identityPoolId: identityPool.identityPoolId,
              apiUrl: lambdas.api.url.url,
              region: instance.region,
            })))
        )),
      ],
      destinationBucket: buckets.staticSite,
      distribution: distributions.primary,
      // HTML paths have no `.`s for extensions or hashes
      exclude: [ "*.*" ],

      contentType: "text/html",
    });
  }
}
