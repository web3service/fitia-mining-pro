#!/usr/bin/env python3
"""Met à jour le manifeste courant à partir des versions source et de l'APK signé."""

import hashlib
import json
import os
import re


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RELEASE_URL = "https://github.com/web3service/fitia-mining-pro/releases/download"


def update_release_manifest(root_dir):
    package_path = os.path.join(root_dir, "package.json")
    android_manifest_path = os.path.join(root_dir, "android-src", "AndroidManifest.xml")
    apk_path = os.path.join(root_dir, "FITIA-PRO-Miner.apk")
    update_manifest_path = os.path.join(root_dir, "update-current.json")

    with open(package_path, "r", encoding="utf-8") as package_file:
        package_version = json.load(package_file)["version"]
    with open(android_manifest_path, "r", encoding="utf-8") as android_file:
        android_manifest = android_file.read()

    code_match = re.search(r'android:versionCode="(\d+)"', android_manifest)
    name_match = re.search(r'android:versionName="([0-9]+\.[0-9]+\.[0-9]+)"', android_manifest)
    if not code_match or not name_match:
        raise RuntimeError("Versions Android introuvables dans AndroidManifest.xml")

    version_code = int(code_match.group(1))
    version_name = name_match.group(1)
    if package_version != version_name:
        raise RuntimeError(
            f"Version package.json ({package_version}) différente d'Android ({version_name})"
        )

    with open(update_manifest_path, "r", encoding="utf-8") as update_file:
        update_manifest = json.load(update_file)

    digest = hashlib.sha256()
    with open(apk_path, "rb") as apk_file:
        for chunk in iter(lambda: apk_file.read(1024 * 1024), b""):
            digest.update(chunk)

    update_manifest.update({
        "enabled": True,
        "versionCode": version_code,
        "versionName": version_name,
        "apkUrl": f"{RELEASE_URL}/v{version_name}/FITIA-PRO-Miner.apk",
        "sha256": digest.hexdigest(),
    })

    with open(update_manifest_path, "w", encoding="utf-8") as update_file:
        json.dump(update_manifest, update_file, ensure_ascii=False, indent=2)
        update_file.write("\n")
    return update_manifest


if __name__ == "__main__":
    result = update_release_manifest(ROOT_DIR)
    print(f"Manifeste courant mis à jour : {result['versionName']} ({result['versionCode']})")
    print(f"APK SHA-256 : {result['sha256']}")
