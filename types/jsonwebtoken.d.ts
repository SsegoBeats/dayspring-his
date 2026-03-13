declare module "jsonwebtoken" {
  export interface SignOptions {
    algorithm?: string
    expiresIn?: string | number
    audience?: string | string[]
    issuer?: string
  }

  export interface VerifyOptions {
    audience?: string | string[]
    issuer?: string
  }

  export function sign(
    payload: string | object | Buffer,
    secretOrPrivateKey: string,
    options?: SignOptions,
  ): string

  export function verify(
    token: string,
    secretOrPublicKey: string,
    options?: VerifyOptions,
  ): string | { [key: string]: any }

  const jwt: {
    sign: typeof sign
    verify: typeof verify
  }

  export default jwt
}
