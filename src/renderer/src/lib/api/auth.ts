import apiClient from "./client";
import type { components } from "./schema";

type SendVerificationCodeRequest =
  components["schemas"]["SendVerificationCodeRequest"];
type LoginRequest = components["schemas"]["LoginRequest"];
type BaseResponse = components["schemas"]["BaseResponse"];
type BaseResponseToken = components["schemas"]["BaseResponse_TokenResponse_"];
type TokenResponse = components["schemas"]["TokenResponse"];

export async function sendVerificationCode(
  target: string,
  type: "email" | "phone" = "email",
  scene: "login" | "bind" = "login"
): Promise<BaseResponse> {
  const body: SendVerificationCodeRequest = { type, target, scene };
  const { data } = await apiClient.post<BaseResponse>(
    "/api/v1/auth/verification-codes",
    body
  );
  return data;
}

export async function loginByEmail(
  email: string,
  code: string
): Promise<TokenResponse> {
  const body: LoginRequest = {
    type: "email",
    identifier: email,
    code,
  };
  const { data } = await apiClient.post<BaseResponseToken>(
    "/api/v1/auth/sessions",
    body
  );
  if (data.code !== 0 || !data.data) {
    throw new Error(data.msg || "Login failed");
  }
  return data.data;
}
