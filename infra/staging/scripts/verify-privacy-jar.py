#!/usr/bin/env python3
"""Check the reviewed privacy cutover markers without extracting/running a JAR."""
import sys
from pathlib import Path
import zipfile


def privacy_aware(path):
    if path.is_symlink() or not path.is_file():
        return False
    try:
        with zipfile.ZipFile(str(path)) as jar:
            required = (
                'BOOT-INF/classes/com/action/camera/privacy/controller/PrivacyController.class',
                'BOOT-INF/classes/com/action/camera/privacy/service/PrivacyRequestInterceptor.class',
            )
            return all(name in jar.namelist() for name in required) and (
                b'PRIVACY_CONSENT_REQUIRED' in jar.read(
                    'BOOT-INF/classes/com/action/camera/common/ErrorCode.class'))
    except (OSError, KeyError, zipfile.BadZipFile):
        return False


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(2)
    passed = privacy_aware(Path(sys.argv[1]))
    print('PRIVACY_JAR=' + ('PASS' if passed else 'MISSING_OR_UNREADABLE'))
    raise SystemExit(0 if passed else 1)
