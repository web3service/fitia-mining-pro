#!/usr/bin/env python3
"""
Script de compilation native de l'APK Android FITIA PRO MINER (com.fitia.miningpro)
Pipeline officiel Android : aapt2 -> ecj (javac) -> d8 (dex) -> 4-byte zipalign -> apksigner (v1+v2+v3)
"""

import glob
import os
import re
import shutil
import subprocess
import sys
import zipfile

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ANDROID_SRC = os.path.join(ROOT_DIR, "android-src")
BUILD_DIR = "/tmp/fitia-apk-build"
TOOLCHAIN_DIR = os.environ.get("ANDROID_TOOLCHAIN_DIR", "/tmp/android-toolchain")
OUTPUT_APK = os.path.join(ROOT_DIR, "FITIA-PRO-Miner.apk")
CERTIFICATE_PIN_FILE = os.path.join(ANDROID_SRC, "release-certificate-sha256.txt")


def run_cmd(cmd, cwd=None):
    sensitive_flags = {"--ks-pass", "--key-pass", "-storepass", "-keypass"}
    display_cmd = [
        "<secret>" if index > 0 and cmd[index - 1] in sensitive_flags else argument
        for index, argument in enumerate(cmd)
    ]
    print("  $", " ".join(display_cmd))
    res = subprocess.run(cmd, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if res.returncode != 0:
        print(res.stdout)
        raise RuntimeError(f"Command failed with exit code {res.returncode}: {' '.join(display_cmd)}")
    return res.stdout


def detect_private_key_alias(keytool_bin, keystore_path, ks_pass):
    """Détecte l'unique clé privée sans imposer un alias propre à l'outil d'export."""
    output = run_cmd([
        keytool_bin,
        "-J-Duser.language=en",
        "-J-Duser.country=US",
        "-list",
        "-keystore", keystore_path,
        "-storepass", ks_pass,
    ])
    private_key_aliases = []
    for line in output.splitlines():
        if "PrivateKeyEntry" not in line or "," not in line:
            continue
        alias = line.split(",", 1)[0].strip()
        if alias:
            private_key_aliases.append(alias)

    if len(private_key_aliases) != 1:
        raise RuntimeError(
            "Le keystore doit contenir exactement une entrée PrivateKeyEntry pour "
            f"la détection automatique ({len(private_key_aliases)} détectée(s))."
        )
    return private_key_aliases[0]


def generate_android_icons():
    """Génère les icônes FITIA Android multi-résolutions et adaptatives."""
    from PIL import Image, ImageDraw

    base_icon_path = os.path.join(ROOT_DIR, "assets", "icon-512.png")
    base_img = Image.open(base_icon_path).convert("RGBA")

    densities = {
        "mdpi": (48, 108),
        "hdpi": (72, 162),
        "xhdpi": (96, 216),
        "xxhdpi": (144, 324),
        "xxxhdpi": (192, 432),
    }

    # Le jeton reste entièrement visible dans la zone sûre circulaire de 66 %
    # des icônes adaptatives Android, quel que soit le masque du lanceur.
    master_size = 864
    logo_size = round(master_size * 0.66)
    logo = base_img.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    fg_master = Image.new("RGBA", (master_size, master_size), (0, 0, 0, 0))
    logo_offset = (master_size - logo_size) // 2
    fg_master.alpha_composite(logo, (logo_offset, logo_offset))

    for dpi, (legacy_px, fg_px) in densities.items():
        mip_dir = os.path.join(ANDROID_SRC, "res", f"mipmap-{dpi}")
        os.makedirs(mip_dir, exist_ok=True)

        # Icône classique : le PNG FITIA conservant sa transparence d'origine.
        ic = base_img.resize((legacy_px, legacy_px), Image.Resampling.LANCZOS)
        ic.save(os.path.join(mip_dir, "fitia_pro_launcher.png"))

        # Icône ronde : applique un masque circulaire aux bords du visuel.
        mask = Image.new("L", (legacy_px * 4, legacy_px * 4), 0)
        mdraw = ImageDraw.Draw(mask)
        mdraw.ellipse([0, 0, legacy_px * 4 - 1, legacy_px * 4 - 1], fill=255)
        mask = mask.resize((legacy_px, legacy_px), Image.Resampling.LANCZOS)
        round_ic = Image.new("RGBA", (legacy_px, legacy_px), (0, 0, 0, 0))
        round_ic.paste(ic, (0, 0), mask)
        round_ic.save(os.path.join(mip_dir, "fitia_pro_launcher_round.png"))

        # Premier plan adaptatif, superposé à @color/ic_launcher_background.
        fg = fg_master.resize((fg_px, fg_px), Image.Resampling.LANCZOS)
        fg.save(os.path.join(mip_dir, "fitia_pro_launcher_foreground.png"))


def write_4byte_aligned_apk(base_apk_path, dex_path, web_files, out_aligned_path):
    """
    Assemble base_apk (resources.arsc + AndroidManifest.xml + res/*) + classes.dex + assets/www/*
    et applique l'alignement strict à 4 octets (identique à `zipalign -p 4`) exigé par Android 11+.
    """
    entries = []  # (arcname, raw_bytes, compress_type)

    with zipfile.ZipFile(base_apk_path, "r") as zin:
        for info in zin.infolist():
            if info.filename.startswith("META-INF/"):
                continue
            data = zin.read(info.filename)
            # resources.arsc et les PNG doivent rester non-compressés (ZIP_STORED)
            if info.filename == "resources.arsc" or info.filename.lower().endswith((".png", ".webp")):
                ctype = zipfile.ZIP_STORED
            else:
                ctype = zipfile.ZIP_DEFLATED
            entries.append((info.filename, data, ctype))

    with open(dex_path, "rb") as f:
        entries.append(("classes.dex", f.read(), zipfile.ZIP_DEFLATED))

    for rel_web_path, full_fs_path in web_files:
        arcname = f"assets/www/{rel_web_path}"
        with open(full_fs_path, "rb") as f:
            data = f.read()
        ctype = zipfile.ZIP_STORED if rel_web_path.lower().endswith((".png", ".webp")) else zipfile.ZIP_DEFLATED
        entries.append((arcname, data, ctype))

    with zipfile.ZipFile(out_aligned_path, "w") as zout:
        for arcname, data, ctype in entries:
            zinfo = zipfile.ZipInfo(filename=arcname, date_time=(2026, 1, 1, 0, 0, 0))
            zinfo.compress_type = ctype
            zinfo.create_system = 3
            zinfo.external_attr = 0o644 << 16

            if ctype == zipfile.ZIP_STORED:
                current_offset = zout.fp.tell()
                fname_len = len(arcname.encode("utf-8"))
                # En-tête local ZIP = 30 octets + longueur nom + longueur extra
                data_start = current_offset + 30 + fname_len
                alignment = 4
                pad = (alignment - (data_start % alignment)) % alignment
                zinfo.extra = b"\x00" * pad
            else:
                zinfo.extra = b""

            zout.writestr(zinfo, data)


def collect_web_files():
    """Embarque uniquement le wallet Android, jamais la page vitrine publique."""
    files = []
    wallet_html = os.path.join(ANDROID_SRC, "wallet.html")
    if not os.path.isfile(wallet_html):
        raise FileNotFoundError(f"Interface Android manquante : {wallet_html}")
    files.append(("wallet.html", wallet_html))

    top_files = ["style.css", "promotion-effects.css", "activity.js", "announcements.js", "promotion-effects.js", "promotions.js", "game-visibility-config.js", "game-visibility.js", "game-visibility.json", "store-catalog.js", "store-order-protocol.js", "store.js", "store-products.json", "farm-config.js", "farm-protocol.js", "farm-3d.js", "farm.js", "wheel-config.js", "wheel.js", "dice-config.js", "dice-3d.js", "dice.js", "arcade-config.js", "arcade-3d.js", "arcade.js", "assistant.js", "app.js", "wallet.js", "manifest.json"]
    for tf in top_files:
        p = os.path.join(ROOT_DIR, tf)
        if os.path.isfile(p):
            files.append((tf, p))

    for subdir in ["vendor", "assets"]:
        sdir = os.path.join(ROOT_DIR, subdir)
        if os.path.isdir(sdir):
            for root, _, fnames in os.walk(sdir):
                for fn in sorted(fnames):
                    full = os.path.join(root, fn)
                    rel = os.path.relpath(full, ROOT_DIR).replace("\\", "/")
                    files.append((rel, full))
    return files


def verify_apk_alignment(apk_path):
    """Vérifie que resources.arsc et tous les fichiers ZIP_STORED sont alignés sur 4 octets."""
    with open(apk_path, "rb") as raw_fp, zipfile.ZipFile(apk_path, "r") as zf:
        for info in zf.infolist():
            if info.compress_type == zipfile.ZIP_STORED:
                raw_fp.seek(info.header_offset + 26)
                fn_len = int.from_bytes(raw_fp.read(2), "little")
                ex_len = int.from_bytes(raw_fp.read(2), "little")
                data_offset = info.header_offset + 30 + fn_len + ex_len
                if data_offset % 4 != 0:
                    raise RuntimeError(f"Unaligned STORED entry {info.filename} at offset {data_offset}")
                if info.filename == "resources.arsc":
                    print(f"  ✓ resources.arsc STORED & 4-byte aligned (offset={data_offset})")


def main():
    java_bin = os.path.join(TOOLCHAIN_DIR, "jdk", "bin", "java")
    keytool_bin = os.path.join(TOOLCHAIN_DIR, "jdk", "bin", "keytool")
    aapt2_bin = os.path.join(TOOLCHAIN_DIR, "aapt2")
    android_jar = os.path.join(TOOLCHAIN_DIR, "android.jar")
    ecj_jar = os.path.join(TOOLCHAIN_DIR, "ecj-3.45.0.jar")
    d8_jar = os.path.join(TOOLCHAIN_DIR, "d8.jar")
    apksigner_jar = os.path.join(TOOLCHAIN_DIR, "apksigner.jar")

    for req in [java_bin, keytool_bin, aapt2_bin, android_jar, ecj_jar, d8_jar, apksigner_jar]:
        if not os.path.exists(req):
            raise FileNotFoundError(f"Outil Android manquant : {req}")

    if os.path.exists(BUILD_DIR):
        shutil.rmtree(BUILD_DIR)
    os.makedirs(os.path.join(BUILD_DIR, "gen"), exist_ok=True)
    os.makedirs(os.path.join(BUILD_DIR, "classes"), exist_ok=True)
    os.makedirs(os.path.join(BUILD_DIR, "dex"), exist_ok=True)

    print("1/6 Génération des icônes Android multi-DPI...")
    generate_android_icons()

    print("2/6 Compilation des ressources Android (aapt2 compile & link)...")
    res_zip = os.path.join(BUILD_DIR, "compiled_res.zip")
    linked_apk = os.path.join(BUILD_DIR, "linked.apk")
    run_cmd([aapt2_bin, "compile", "--dir", os.path.join(ANDROID_SRC, "res"), "-o", res_zip])
    run_cmd([
        aapt2_bin, "link",
        "-I", android_jar,
        "--manifest", os.path.join(ANDROID_SRC, "AndroidManifest.xml"),
        "--java", os.path.join(BUILD_DIR, "gen"),
        "-o", linked_apk,
        res_zip
    ])

    print("3/6 Compilation du code Java Android (Eclipse Compiler ECJ)...")
    java_sources = (
        glob.glob(os.path.join(ANDROID_SRC, "java", "**", "*.java"), recursive=True) +
        glob.glob(os.path.join(BUILD_DIR, "gen", "**", "*.java"), recursive=True)
    )
    run_cmd([
        java_bin, "-jar", ecj_jar,
        "-8",
        "-encoding", "UTF-8",
        "-bootclasspath", android_jar,
        "-classpath", android_jar,
        "-d", os.path.join(BUILD_DIR, "classes"),
        *java_sources
    ])

    print("4/6 Conversion en bytecode Dalvik Android (D8 -> classes.dex)...")
    class_files = glob.glob(os.path.join(BUILD_DIR, "classes", "**", "*.class"), recursive=True)
    run_cmd([
        java_bin, "-cp", d8_jar, "com.android.tools.r8.D8",
        "--release",
        "--min-api", "24",
        "--lib", android_jar,
        "--output", os.path.join(BUILD_DIR, "dex"),
        *class_files
    ])

    print("5/6 Assemblage des assets Web autonomes + Alignement ZIP 4 octets...")
    web_files = collect_web_files()
    print(f"  ✓ {len(web_files)} fichiers web embarqués dans assets/www/")
    aligned_apk = os.path.join(BUILD_DIR, "aligned.apk")
    write_4byte_aligned_apk(
        linked_apk,
        os.path.join(BUILD_DIR, "dex", "classes.dex"),
        web_files,
        aligned_apk
    )
    verify_apk_alignment(aligned_apk)

    print("6/6 Signature cryptographique de l'APK avec le certificat stable (v1 + v2 + v3)...")
    keystore_path = os.environ.get(
        "FITIA_ANDROID_KEYSTORE",
        os.path.join(ANDROID_SRC, "keystore", "fitia-release.p12")
    )
    ks_pass = os.environ.get("FITIA_ANDROID_KEYSTORE_PASSWORD", "FitiaProMining2026!")
    key_pass = os.environ.get("FITIA_ANDROID_KEY_PASSWORD", ks_pass)
    configured_alias = os.environ.get("FITIA_ANDROID_KEY_ALIAS", "").strip()

    if not os.path.isfile(keystore_path):
        raise FileNotFoundError(
            "Clé de signature stable introuvable. Restaurez le fichier .p12/.jks dans "
            "android-src/keystore/ ou définissez FITIA_ANDROID_KEYSTORE. "
            "Aucune nouvelle clé n'est générée automatiquement."
        )
    if not os.path.isfile(CERTIFICATE_PIN_FILE):
        raise FileNotFoundError(f"Empreinte de certificat attendue manquante : {CERTIFICATE_PIN_FILE}")
    with open(CERTIFICATE_PIN_FILE, "r", encoding="utf-8") as cert_file:
        expected_cert_sha256 = cert_file.read().strip().lower()
    if not re.fullmatch(r"[0-9a-f]{64}", expected_cert_sha256):
        raise RuntimeError("L'empreinte SHA-256 du certificat attendu est invalide.")

    alias = configured_alias or detect_private_key_alias(keytool_bin, keystore_path, ks_pass)
    print(f"  ✓ Alias de la clé privée utilisé pour la signature : {alias}")

    run_cmd([
        java_bin, "-jar", apksigner_jar, "sign",
        "--ks", keystore_path,
        "--ks-key-alias", alias,
        "--ks-pass", f"pass:{ks_pass}",
        "--key-pass", f"pass:{key_pass}",
        "--v1-signing-enabled", "true",
        "--v2-signing-enabled", "true",
        "--v3-signing-enabled", "true",
        "--out", OUTPUT_APK,
        aligned_apk
    ])

    verify_out = run_cmd([java_bin, "-jar", apksigner_jar, "verify", "--verbose", "--print-certs", OUTPUT_APK])
    print(verify_out.strip())
    cert_match = re.search(r"Signer #1 certificate SHA-256 digest:\s*([0-9a-fA-F]{64})", verify_out)
    actual_cert_sha256 = cert_match.group(1).lower() if cert_match else ""
    if actual_cert_sha256 != expected_cert_sha256:
        os.remove(OUTPUT_APK)
        raise RuntimeError(
            "Le certificat de l'APK ne correspond pas au certificat stable attendu. "
            "L'APK non conforme a été supprimé."
        )
    print(f"  ✓ Certificat stable vérifié : {actual_cert_sha256}")
    badging_out = run_cmd([aapt2_bin, "dump", "badging", OUTPUT_APK])
    for line in badging_out.splitlines()[:8]:
        print(" ", line)

    size_kb = os.path.getsize(OUTPUT_APK) / 1024
    print(f"\n✅ APK ANDROID PRÊT : {OUTPUT_APK} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
