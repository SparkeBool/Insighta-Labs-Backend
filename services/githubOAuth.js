import axios from "axios";

export async function exchangeCodeForToken(code, codeVerifier, redirectUri) {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    client_secret: process.env.GITHUB_CLIENT_SECRET,
    code: code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  });
  
  if (codeVerifier) {
    params.append("code_verifier", codeVerifier);
  }
  
  const response = await axios.post(
    "https://github.com/login/oauth/access_token",
    params,
    {
      headers: {
        "Accept": "application/json"
      }
    }
  );
  
  return response.data;
}

export async function getGitHubUser(accessToken) {
  const response = await axios.get("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  
  return response.data;
}