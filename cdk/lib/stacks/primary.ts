import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AppInstance } from '../instances';
import { ApiRole, EditorRole } from '../iam/roles';
import { DataBucket, StaticSiteBucket } from '../s3/buckets';
import { StaticSiteNonHashedAssetsDeployment, StaticSiteHashedAssetsDeployment, StaticSiteHtmlPathsDeployment } from '../deployments';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { PrimaryCloudFrontDistribution } from '../cloudfront/distributions';
import { EditorIdentityPool } from '../cognito/identity-pools';
import { ApiFunction } from '../lambda/functions';
import { readdirSync, statSync } from 'node:fs';
import { Source, ISource } from "aws-cdk-lib/aws-s3-deployment";

interface PrimaryStackProps {
  instance: AppInstance,
}

export class PrimaryStack extends Stack {
  readonly usEast1Stack: Stack;
  readonly dataBucket: IBucket;

  constructor(scope: Construct, {
    instance,
  }: PrimaryStackProps) {
    super(scope, `Plants-PrimaryStack`, {
      crossRegionReferences: true,
    });

    this.usEast1Stack = 
      new Stack(scope, `Plants-UsEast1Stack`, { 
        env: { region: "us-east-1" }, 
        description: `Secondary stack for resources that need to be in us-east-1`
      });

    const roles = {
      api: new ApiRole(this),
      editor: new EditorRole(this),
    };

    const buckets = {
      data: new DataBucket(this, { instance, roles, }),
      staticSite: new StaticSiteBucket(this),
    };
    
    const lambdas = {
      api: new ApiFunction(this, { buckets, roles }),
    };

    const identityPool = 
      new EditorIdentityPool(this, { roles, });

    const distributions = {
      primary: new PrimaryCloudFrontDistribution(this, { instance, buckets, lambdas }),
    };

    // Allow the deployments to split up subsets of the static files to deploy with slightly different configurations
    const websiteAssetsDir =  `../dist/website/${instance.name}`;
    const staticSiteFiles = readdirSync(websiteAssetsDir, { recursive: true, encoding: "utf8" })
    function source(filterFn: (path: string) => boolean) {
      return Source.asset(websiteAssetsDir, { 
        exclude: staticSiteFiles.filter(path => statSync(`${websiteAssetsDir}/${path}`).isFile() && !filterFn(path))
      });
    }
    
    new StaticSiteHashedAssetsDeployment(this, { source, buckets, distributions, });
    new StaticSiteNonHashedAssetsDeployment(this, { source, buckets, distributions, });
    new StaticSiteHtmlPathsDeployment(this, { instance, source, buckets, distributions, lambdas, identityPool });
  }
}