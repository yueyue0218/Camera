import { NativeSessionResponse } from '../model/ApiModels';

export interface NativeSessionApi {
  refresh(refreshToken: string): Promise<NativeSessionResponse>;
  logout(): Promise<boolean>;
}
