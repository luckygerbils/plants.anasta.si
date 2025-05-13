import { IdentityPool, UserPoolAuthenticationProvider } from "aws-cdk-lib/aws-cognito-identitypool";
import { AccountRecovery, Mfa, UserPool, UserPoolClient, UserPoolClientIdentityProvider } from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";
import { EditorRole } from "../../iam/roles/editor";

interface EditorIdentityPoolProps {
  roles: {
    editor: EditorRole,
  }
}

export class EditorIdentityPool extends IdentityPool {
  readonly userPool: UserPool;
  readonly userPoolClient: UserPoolClient;

  constructor(scope: Construct, {
    roles
  }: EditorIdentityPoolProps) {
    const userPool = new UserPool(scope, "EditorUserPool", {
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      mfa: Mfa.OPTIONAL,
    });

    const userPoolClient = new UserPoolClient(scope, "EditorUserPoolClient", {
      userPool,
      authFlows: {
        userSrp: true,
      },
      supportedIdentityProviders: [
        UserPoolClientIdentityProvider.COGNITO,
      ]
    });

    super(scope, "EditorIdentityPool", {
      authenticationProviders: {
        userPools: [ new UserPoolAuthenticationProvider({ userPool, userPoolClient }) ],
      },
      authenticatedRole: roles.editor,
    });

    roles.editor.grantIdentityPoolAssumeRole(this);

    this.userPool = userPool;
    this.userPoolClient = userPoolClient;
  }
}