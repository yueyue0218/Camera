import BuildProfile from 'entry/BuildProfile';

/** Keeps generated Hvigor fields behind one small application adapter. */
export class BuildEnvironment {
  static environment(): string {
    return BuildProfile.PORTRA_ENVIRONMENT;
  }

  static baseUrl(): string {
    return BuildProfile.PORTRA_BASE_URL;
  }
}
