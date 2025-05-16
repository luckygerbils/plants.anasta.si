let props: { userPoolClientId: string, userPoolId: string, identityPoolId: string, apiUrl: string, region: string }|null = null;
function getProps() {
  if (props == null) {
    props = JSON.parse(window.props);
  }
  return props!;
}

interface InitiateAuthResponse {
  AuthenticationResult: { 
     AccessToken: string,
     ExpiresIn: number,
     IdToken: string,
     RefreshToken: string,
  },
}

export async function login(username: string, password: string) {
  const {
    AuthenticationResult: {
      IdToken: idToken,
      RefreshToken: refreshToken,
      ExpiresIn: expiresIn,
    }
  }: InitiateAuthResponse = await (await fetch("https://cognito-idp.us-west-2.amazonaws.com/", {
    method: "POST",
    headers: {
      "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
      "Content-Type": "application/x-amz-json-1.1"
    },
    body: JSON.stringify({
      "AuthFlow": "USER_PASSWORD_AUTH",
      "AuthParameters": { 
        "USERNAME" : username,
        "PASSWORD" : password
      },
      "ClientId": getProps().userPoolClientId,
    })
  })).json();

  const cognitoIdpAuth: CognitoIdpAuth = {
    idToken,
    refreshToken,
    expires: +(new Date()) + (expiresIn*1000),
  };

  localStorage.setItem("cognitoIdpAuth", JSON.stringify(cognitoIdpAuth));
}

interface CognitoIdpAuth {
  idToken: string,
  refreshToken: string,
  expires: number,
}

let cognitoIdpAuth: CognitoIdpAuth|null = null;
function getIdToken() {
  if (cognitoIdpAuth == null && typeof localStorage != "undefined") {
    const storedAuth = localStorage.getItem("cognitoIdpAuth");
    if (storedAuth != null) {
      cognitoIdpAuth = JSON.parse(storedAuth);
    }
  }

  if (cognitoIdpAuth != null && cognitoIdpAuth.expires < (+(new Date()) + 60)) {
    return null;
  }
  return cognitoIdpAuth?.idToken;
}

export function loggedIn(): boolean {
  return getIdToken() != null;
}

let identityId: string|null = null;
async function getId() {
  if (identityId == null) {
    const idToken = getIdToken();
    if (idToken == null) {
      throw new Error("No id token. Need to re-login");
    }
    const response = await (await fetch("https://cognito-identity.us-west-2.amazonaws.com/", {
      method: "POST",
      headers: {
        "X-Amz-Target": "AWSCognitoIdentityService.GetId",
        "Content-Type": "application/x-amz-json-1.1"
      },
      body: JSON.stringify({
        "IdentityPoolId": getProps().identityPoolId,
        "Logins": {
          [`cognito-idp.us-west-2.amazonaws.com/${getProps().userPoolId}`]: idToken
        },
      })
    })).json();
    identityId = response.IdentityId;
  }
  return identityId;
}

interface GetCredentialsForIdentityResponse {
  Credentials: { 
     AccessKeyId: string,
     Expiration: number,
     SecretKey: string,
     SessionToken: string,
  },
  IdentityId: string
}

interface AwsCredentials {
  accessKeyId: string,
  secretKey: string,
  sessionToken: string,
  expires: number,
}

let credentials: AwsCredentials|null = null;
async function getCredentials(): Promise<AwsCredentials|null> {
  if (credentials == null) {
    const idToken = getIdToken();
    if (idToken == null) {
      throw new Error("No id token. Need to re-login");
    }
    const response: GetCredentialsForIdentityResponse = await (await fetch("https://cognito-identity.us-west-2.amazonaws.com/", {
      method: "POST",
      headers: {
        "X-Amz-Target": "AWSCognitoIdentityService.GetCredentialsForIdentity",
        "Content-Type": "application/x-amz-json-1.1"
      },
      body: JSON.stringify({
        "IdentityId": await getId(),
        "Logins": {
          [`cognito-idp.us-west-2.amazonaws.com/${getProps().userPoolId}`]: idToken
        },
      })
    })).json();
    credentials = {
      accessKeyId: response.Credentials.AccessKeyId,
      secretKey: response.Credentials.SecretKey,
      sessionToken: response.Credentials.SessionToken,
      expires: +(new Date()) + response.Credentials.Expiration *1000,
    };
  }

  if (credentials != null && credentials.expires < (+(new Date()) + 60)) {
    return null;
  }
  return credentials;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
	const fetchRequest = new Request(input, init);
	const url = new URL(fetchRequest.url, location.href);
	const headers = new Headers(fetchRequest.headers);
  const body = await fetchRequest.text();
  const method = fetchRequest.method?.toUpperCase() ?? "GET" // method must be uppercase

  const credentials = await getCredentials();
  if (credentials == null) {
    throw new Error("Credentials missing or expired");
  }

  const { accessKeyId, secretKey, sessionToken } = credentials;
  const { region, apiUrl } = getProps();
  const service = "lambda";

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');
  const amzDate = `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  const dateStamp = amzDate.slice(0, 8);

  const requestBodyHash = await sha256(body);

	// host is required by AWS Signature V4: https://docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html
	// headers.append("host", new URL(config.apiUrl).host);
  headers.append("host", new URL(apiUrl).host);
  headers.append('X-Amz-Date', amzDate);
  headers.append('X-Amz-Content-Sha256', requestBodyHash);
  headers.append('X-Amz-Security-Token', sessionToken);

  const canonicalRequest = createCanonicalRequest(method, url.pathname, service, url.search, headers, requestBodyHash);

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service);
  const stringToSign = await getSignatureSubject(algorithm, amzDate, credentialScope, canonicalRequest);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  headers.append(
    "Authorization", 
    `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${getSignedHeaders(headers)}, Signature=${signature}`);

	return fetch(url.href, { method, headers, body, });
}

function createCanonicalRequest(method: string, path: string, service: string, queryParams: string, headers: Headers, payloadHash: string) {
  const canonicalPath = getCanonicalPath(path, service === 's3');
  const allHeaders: string[] = [];
  headers.forEach((value, key) => {
    allHeaders.push(`${key.toLowerCase()}:${value.trim()}\n`)
  });
  const canonicalHeaders = allHeaders.sort().join('');
  const signedHeaders = getSignedHeaders(headers);
  return `${method}\n${canonicalPath}\n${queryParams}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
}

function getSignedHeaders(headers: Headers) {
  const allHeaders: string[] = [];
  headers.forEach((_, key) => allHeaders.push(key.toLowerCase()));
  return allHeaders.join(';');
}

async function getSignatureKey(secretKey: string, dateStamp: string, regionName: string, serviceName: string) {
  const encoder = new TextEncoder();
  const keyUint8Array = encoder.encode(`AWS4${secretKey}`);
  const kDate = await hmacSha256(keyUint8Array, dateStamp);
  const kRegion = await hmacSha256(kDate, regionName);
  const kService = await hmacSha256(kRegion, serviceName);
  const kSigning = await hmacSha256(kService, "aws4_request");
  return kSigning;
};

async function getSignatureSubject(algorithm: string, amzDate: string, scope: string, canonicalRequest: string) {
  const hashedCanonicalRequest = await sha256(canonicalRequest);
  return `${algorithm}\n${amzDate}\n${scope}\n${hashedCanonicalRequest}`;
}

function getCanonicalPath(path: string, isS3: boolean) {
    if (!isS3) {
        // Non-S3 services, we normalize the path and then double URI encode it.
        // Ref: "Remove Dot Segments" https://datatracker.ietf.org/doc/html/rfc3986#section-5.2.4
        const normalizedPathSegments = [];
        for (const pathSegment of path.split("/")) {
            if (pathSegment?.length === 0)
                continue;
            if (pathSegment === ".")
                continue;
            if (pathSegment === "..") {
                normalizedPathSegments.pop();
            }
            else {
                normalizedPathSegments.push(pathSegment);
            }
        }
        // Joining by single slashes to remove consecutive slashes.
        const normalizedPath = `${path?.startsWith("/") ? "/" : ""}${normalizedPathSegments.join("/")}${normalizedPathSegments.length > 0 && path?.endsWith("/") ? "/" : ""}`;
        const doubleEncoded = encodeURIComponent(normalizedPath);
        return doubleEncoded.replace(/%2F/g, "/");
    }
    // For S3, we shouldn't normalize the path. For example, object name
    // my-object//example//photo.user should not be normalized to
    // my-object/example/photo.user
    return path;
}

async function sha256(input: string) {
  const textAsBuffer = new TextEncoder().encode(input);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", textAsBuffer);
  return toHex(hashBuffer);
}

async function hmacSha256(secretKeyBytes: BufferSource, message: string) {
  const messageUint8Array = new TextEncoder().encode(message);
  const cryptoKey = await window.crypto.subtle.importKey("raw", secretKeyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return await window.crypto.subtle.sign("HMAC", cryptoKey, messageUint8Array);
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
