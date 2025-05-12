import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { AppInstance, Beta } from "../../instances";
import { IRole } from "aws-cdk-lib/aws-iam";

interface DataBucketProps {
  instance: AppInstance,
  roles: {
    api: IRole,
  }
}

export class DataBucket extends Bucket {
  constructor(scope: Construct, { instance, roles }: DataBucketProps) {
    super(scope, "DataBucket", {
      removalPolicy: RemovalPolicy.RETAIN,
      bucketName: DataBucket.bucketName(instance),
      versioned: true,
      lifecycleRules: [
        {
          noncurrentVersionExpiration: Duration.days(7),
        }
      ]
    });

    this.grantReadWrite(roles.api);
  }

  static bucketName(instance: AppInstance): string {
    return new Map()
        .set(Beta, `beta-plants-primarystack-databuckete3889a50-iytembxt8apg`)
        .get(instance) ?? (() => { throw new Error(`No bucket name defined for ${instance.name}`); })();
  }
}