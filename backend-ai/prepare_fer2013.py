import argparse
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen

import pyarrow.parquet as parquet
from PIL import Image


SPLITS = {
    "train": "https://huggingface.co/api/datasets/Jeneral/fer-2013/parquet/default/train/0.parquet",
    "val": "https://huggingface.co/api/datasets/Jeneral/fer-2013/parquet/default/test/0.parquet",
}
LABELS = ["Angry", "Disgust", "Fear", "Happy", "Neutral", "Sad", "Surprise"]
DATA_DIR = Path(__file__).resolve().parent / "data" / "emotion"


def download_split(split: str, output_dir: Path) -> int:
    request = Request(SPLITS[split], headers={"User-Agent": "EmotionRegco/1.0"})
    with urlopen(request, timeout=60) as response:
        table = parquet.read_table(BytesIO(response.read()))

    if not {"img_bytes", "labels"}.issubset(table.column_names):
        raise ValueError(f"Unexpected {split} parquet columns: {table.column_names}")

    image_bytes = table["img_bytes"].to_pylist()
    class_ids = table["labels"].to_pylist()
    for image_index, (image_data, class_id) in enumerate(zip(image_bytes, class_ids)):
        if image_data is None or class_id is None or not 0 <= int(class_id) < len(LABELS):
            continue
        class_name = LABELS[int(class_id)]
        class_dir = output_dir / split / class_name
        class_dir.mkdir(parents=True, exist_ok=True)
        with Image.open(BytesIO(image_data)) as image:
            image.convert("RGB").save(class_dir / f"{image_index:06d}.jpg", format="JPEG")

    return len(image_bytes)


def main():
    parser = argparse.ArgumentParser(
        description="Download and prepare the public FER-2013 dataset for train.py."
    )
    parser.add_argument("--output-dir", type=Path, default=DATA_DIR)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    for split in SPLITS:
        row_count = download_split(split, args.output_dir)
        print(f"Prepared {row_count} {split} images in {args.output_dir / split}")
    print("Dataset source: Jeneral/fer-2013 (FER-2013; dataset card declares Apache-2.0).")


if __name__ == "__main__":
    main()