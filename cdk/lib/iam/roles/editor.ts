import { IdentityPool } from "aws-cdk-lib/aws-cognito-identitypool";
import { AccountRootPrincipal, CfnRole, FederatedPrincipal, PolicyStatement, Role } from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export class EditorRole extends Role {
  constructor(scope: Construct) {
    super(scope, "EditorRole", {
      // Dummy. Will be replaced by actual policy when the identity pool is created
      assumedBy: new AccountRootPrincipal(),
    });
    // Delete the dummy policy
    (this.node.defaultChild as CfnRole)
      .addPropertyDeletionOverride('AssumeRolePolicyDocument.Statement.0');
  }

  grantIdentityPoolAssumeRole(identityPool: IdentityPool) {
    this.assumeRolePolicy?.addStatements(new PolicyStatement({
      actions: ["sts:AssumeRoleWithWebIdentity"],
      principals: [
        new FederatedPrincipal("cognito-identity.amazonaws.com", {
          'StringEquals': {
            'cognito-identity.amazonaws.com:aud': identityPool.identityPoolId,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': "authenticated",
          },
        }, 'sts:AssumeRoleWithWebIdentity'),
      ],
    }));
  }
}