import { AllowedMethods, Distribution, ResponseHeadersPolicy, ViewerProtocolPolicy } from "aws-cdk-lib/aws-cloudfront";
import { PrimaryStack } from "../../stacks/primary";
import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";
import { AppInstance } from "../../instances";
import { ARecord, PublicHostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { Bucket, IBucket } from "aws-cdk-lib/aws-s3";
import { FunctionUrlOrigin, S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import { Construct } from "constructs";
import { FunctionUrl } from "aws-cdk-lib/aws-lambda";

interface PrimaryCloudFrontDistributionProps {
  instance: AppInstance,
  buckets: {
    staticSite: IBucket,
    data: IBucket,
  },
  lambdas: {
    api: { url: FunctionUrl, },
  }
}

export class PrimaryCloudFrontDistribution extends Distribution {
  constructor(scope: Construct & { usEast1Stack: Construct }, { 
    instance,
    buckets,
    lambdas,
  }: PrimaryCloudFrontDistributionProps) {
    // Create DNS records inside existing hosted zone
    const anastaSi = PublicHostedZone.fromHostedZoneAttributes(scope, "AnastaSi", {
        hostedZoneId: "Z3PODT6L2Y6659",
        zoneName: "anasta.si",
      });
  
    super(scope, 'CloudFrontDistribution', {
      certificate: new Certificate(scope.usEast1Stack, "StaticSiteCertificate", {
        domainName: instance.domainName,
        validation: CertificateValidation.fromDns(anastaSi),
      }),
      domainNames: [ instance.domainName ],
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(buckets.staticSite),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        "/data/*": {
          origin: S3BucketOrigin.withOriginAccessControl(buckets.data),
        },
        "/api/*": {
          origin: new FunctionUrlOrigin(lambdas.api.url),
          allowedMethods: AllowedMethods.ALLOW_ALL,
        },
      }
    });

    new ARecord(this, "WebsiteARecord", {
      zone: anastaSi,
      recordName: instance.domainName.substring(0, instance.domainName.length - ".anasta.si".length),
      target: RecordTarget.fromAlias(new CloudFrontTarget(this)),
    });
  }
}