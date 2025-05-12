import { Stack } from "aws-cdk-lib";
import { CompositePrincipal, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class ApiRole extends Role {
  constructor(scope: Construct) {
    super(scope, "ApiRole", {
      assumedBy: new CompositePrincipal(
        new ServicePrincipal("lambda.amazonaws.com"),
        // Role.fromRoleArn(
        //   scope, 
        //   "AdministratorRole", 
        //   Stack.of(scope).formatArn({
        //     service: "iam",
        //     region: "",
        //     resource: "role/aws-reserved",
        //     resourceName: `sso.amazonaws.com/${Stack.of(scope).region}/AWSReservedSSO_AdministratorAccess_ba03be9cf2d41a0b`,
        //   }),
        // ),
      ),
    });
    // Since we're specifying the lambda role, we have to manually specify this managed policy
    this.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"))
  }
}