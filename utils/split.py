import zipfile
import random
import shutil
from pathlib import Path

# ============================================================
# SETTINGS
# ============================================================

# Your original dataset
INPUT_ZIP = Path("./archive.zip")

# Temporary working directory
WORK_DIR = Path("hiragana_split")

# Extracted original dataset
EXTRACT_DIR = WORK_DIR / "original"

# Output folders
TRAIN_DIR = WORK_DIR / "train"
TEST_DIR = WORK_DIR / "test"

# Final ZIP
OUTPUT_ZIP = Path("hiragana_train_test.zip")

# 20% testing, 80% training
TEST_RATIO = 0.20

# Makes the split reproducible
RANDOM_SEED = 42


# ============================================================
# 1. CLEAN OLD FILES
# ============================================================

if WORK_DIR.exists():
    shutil.rmtree(WORK_DIR)

if OUTPUT_ZIP.exists():
    OUTPUT_ZIP.unlink()


# Create directories
EXTRACT_DIR.mkdir(parents=True)
TRAIN_DIR.mkdir(parents=True)
TEST_DIR.mkdir(parents=True)


# ============================================================
# 2. EXTRACT ORIGINAL ZIP
# ============================================================

print("Extracting dataset...")

with zipfile.ZipFile(INPUT_ZIP, "r") as zip_ref:
    zip_ref.extractall(EXTRACT_DIR)


# ============================================================
# 3. FIND CHARACTER FOLDERS
# ============================================================

class_folders = sorted([
    folder
    for folder in EXTRACT_DIR.iterdir()
    if folder.is_dir()
])

print(f"Found {len(class_folders)} classes.")


# ============================================================
# 4. SPLIT EACH CHARACTER
# ============================================================

random.seed(RANDOM_SEED)

total_train = 0
total_test = 0

for class_folder in class_folders:

    # Get image files
    images = sorted([
        image
        for image in class_folder.iterdir()
        if image.is_file()
        and image.suffix.lower() in {
            ".jpg",
            ".jpeg",
            ".png",
            ".bmp",
            ".gif"
        }
    ])

    # Shuffle images
    random.shuffle(images)

    # Number of test images
    test_count = int(len(images) * TEST_RATIO)

    # Split
    test_images = images[:test_count]
    train_images = images[test_count:]

    # Create class folders
    train_class_dir = TRAIN_DIR / class_folder.name
    test_class_dir = TEST_DIR / class_folder.name

    train_class_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    test_class_dir.mkdir(
        parents=True,
        exist_ok=True
    )

    # Copy training images
    for image in train_images:

        shutil.copy2(
            image,
            train_class_dir / image.name
        )

    # Copy testing images
    for image in test_images:

        shutil.copy2(
            image,
            test_class_dir / image.name
        )

    # Update counters
    total_train += len(train_images)
    total_test += len(test_images)

    print(
        f"{class_folder.name:>5}: "
        f"{len(train_images)} train / "
        f"{len(test_images)} test"
    )


# ============================================================
# 5. CREATE FINAL ZIP
# ============================================================

print("\nCreating ZIP file...")

with zipfile.ZipFile(
    OUTPUT_ZIP,
    "w",
    compression=zipfile.ZIP_DEFLATED
) as zipf:

    # Add train folder
    for file in TRAIN_DIR.rglob("*"):

        if file.is_file():

            archive_path = (
                Path("train")
                / file.relative_to(TRAIN_DIR)
            )

            zipf.write(
                file,
                archive_path
            )

    # Add test folder
    for file in TEST_DIR.rglob("*"):

        if file.is_file():

            archive_path = (
                Path("test")
                / file.relative_to(TEST_DIR)
            )

            zipf.write(
                file,
                archive_path
            )


# ============================================================
# 6. PRINT SUMMARY
# ============================================================

print("\n======================================")
print("DATASET SPLIT COMPLETE")
print("======================================")

print(f"Classes       : {len(class_folders)}")
print(f"Total images  : {total_train + total_test}")
print(f"Training      : {total_train}")
print(f"Testing       : {total_test}")
print(f"Test ratio    : {TEST_RATIO * 100:.0f}%")
print(f"Output ZIP    : {OUTPUT_ZIP}")

print("======================================")

print("""
Final structure:

hiragana_train_test.zip
│
├── train/
│   ├── aa/
│   ├── chi/
│   ├── ee/
│   ├── ...
│   └── yu/
│
└── test/
    ├── aa/
    ├── chi/
    ├── ee/
    ├── ...
    └── yu/
""")

print("Done!")