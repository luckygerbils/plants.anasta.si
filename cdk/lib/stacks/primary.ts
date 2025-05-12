import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AppInstance } from '../instances';
import { ApiRole } from '../iam/roles';
import { DataBucket, StaticSiteBucket } from '../s3/buckets';
import { StaticSiteDeployment } from '../deployments';
import { IBucket } from 'aws-cdk-lib/aws-s3';

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

    const roles = {
      api: new ApiRole(this),
    };

    const buckets = {
      data: new DataBucket(this, { instance, roles, }),
      staticSite: new StaticSiteBucket(this),
    };
    this.dataBucket = buckets.data;
    
    new StaticSiteDeployment(this, { instance, buckets, });
  }
}