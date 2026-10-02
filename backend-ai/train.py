import argparse
import random
from copy import deepcopy
from pathlib import Path

import torch
from torch import nn
from torch.optim import AdamW
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
from torchvision.models import MobileNet_V3_Large_Weights, mobilenet_v3_large


EMOTIONS = {"Angry", "Disgust", "Fear", "Happy", "Sad", "Surprise", "Neutral"}
IMAGE_MEAN = (0.485, 0.456, 0.406)
IMAGE_STD = (0.229, 0.224, 0.225)
DEFAULT_IMAGE_SIZE = 224
BACKEND_DIR = Path(__file__).resolve().parent


def parse_args():
    parser = argparse.ArgumentParser(
        description="Fine-tune MobileNetV3-Large for seven-class facial emotion recognition."
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=BACKEND_DIR / "data" / "emotion",
        help="Folder containing train/ and val/ ImageFolder datasets.",
    )
    parser.add_argument("--warmup-epochs", type=int, default=5)
    parser.add_argument("--finetune-epochs", type=int, default=30)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--image-size", type=int, choices=(128, 160, 224), default=DEFAULT_IMAGE_SIZE)
    parser.add_argument("--unfreeze-last-layers", type=int, default=25)
    parser.add_argument("--backbone-learning-rate", type=float, default=3.5e-5)
    parser.add_argument("--classifier-learning-rate", type=float, default=1e-4)
    parser.add_argument("--weight-decay", type=float, default=1.5e-2)
    parser.add_argument("--patience", type=int, default=8)
    parser.add_argument(
        "--output",
        type=Path,
        default=BACKEND_DIR / "models" / "mobilenetv3_large_emotion.pth",
    )
    parser.add_argument("--device", choices=("auto", "cpu", "cuda"), default="auto")
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def make_datasets(data_dir: Path, image_size: int):
    train_dir = data_dir / "train"
    val_dir = data_dir / "val"
    if not train_dir.is_dir() or not val_dir.is_dir():
        raise FileNotFoundError(
            f"Expected dataset folders at {train_dir} and {val_dir}."
        )

    train_transform = transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomRotation(degrees=15),
        transforms.RandomAffine(degrees=0, translate=(0.08, 0.08)),
        transforms.ColorJitter(brightness=0.15, contrast=0.15),
        transforms.ToTensor(),
        transforms.Normalize(IMAGE_MEAN, IMAGE_STD),
        transforms.RandomErasing(p=0.15, scale=(0.02, 0.1)),
    ])
    val_transform = transforms.Compose([
        transforms.Resize((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(IMAGE_MEAN, IMAGE_STD),
    ])
    train_set = datasets.ImageFolder(train_dir, transform=train_transform)
    val_set = datasets.ImageFolder(val_dir, transform=val_transform)

    labels = [
        label for label, _ in sorted(train_set.class_to_idx.items(), key=lambda item: item[1])
    ]
    if set(labels) != EMOTIONS:
        raise ValueError(f"Expected these seven class folders: {sorted(EMOTIONS)}; got {labels}")
    if val_set.class_to_idx != train_set.class_to_idx:
        raise ValueError("Train and val folders must contain the same emotion classes.")
    return train_set, val_set, labels


def set_trainable_layers(model, last_layer_count):
    for parameter in model.parameters():
        parameter.requires_grad = False

    parameterized_layers = [
        module
        for module in model.features.modules()
        if any(True for _ in module.parameters(recurse=False))
    ]
    if not 1 <= last_layer_count < len(parameterized_layers):
        raise ValueError(
            f"unfreeze-last-layers must be between 1 and {len(parameterized_layers) - 1}."
        )

    for module in parameterized_layers[-last_layer_count:]:
        for parameter in module.parameters(recurse=False):
            parameter.requires_grad = True
    for parameter in model.classifier.parameters():
        parameter.requires_grad = True

    return len(parameterized_layers)


def train_one_epoch(model, loader, criterion, optimizer, device, fine_tuning):
    model.train()
    if not fine_tuning:
        model.features.eval()
    else:
        for module in model.modules():
            if isinstance(module, nn.BatchNorm2d):
                module.eval()

    total_loss = 0.0
    correct = 0
    total = 0
    for images, targets in loader:
        images = images.to(device, non_blocking=True)
        targets = targets.to(device, non_blocking=True)
        optimizer.zero_grad(set_to_none=True)
        with torch.set_grad_enabled(True):
            logits = model(images)
            loss = criterion(logits, targets)
            loss.backward()
            optimizer.step()

        total_loss += loss.item() * targets.size(0)
        correct += (logits.argmax(dim=1) == targets).sum().item()
        total += targets.size(0)

    return total_loss / total, correct / total


def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss = 0.0
    correct = 0
    total = 0
    with torch.inference_mode():
        for images, targets in loader:
            images = images.to(device, non_blocking=True)
            targets = targets.to(device, non_blocking=True)
            logits = model(images)
            total_loss += criterion(logits, targets).item() * targets.size(0)
            correct += (logits.argmax(dim=1) == targets).sum().item()
            total += targets.size(0)
    return total_loss / total, correct / total


def train_phase(model, train_loader, val_loader, criterion, optimizer, device,
                epochs, patience, phase_name, fine_tuning, scheduler_min_lr,
                output, labels, image_size, best_accuracy, best_state):
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=epochs, eta_min=scheduler_min_lr
    )
    phase_best = -1.0
    epochs_without_improvement = 0

    for epoch in range(1, epochs + 1):
        train_loss, train_accuracy = train_one_epoch(
            model, train_loader, criterion, optimizer, device, fine_tuning
        )
        val_loss, val_accuracy = evaluate(model, val_loader, criterion, device)
        scheduler.step()
        learning_rates = ", ".join(f"{group['lr']:.1e}" for group in optimizer.param_groups)
        print(
            f"{phase_name} {epoch}/{epochs} | "
            f"train loss {train_loss:.4f}, accuracy {train_accuracy:.2%} | "
            f"val loss {val_loss:.4f}, accuracy {val_accuracy:.2%} | lr {learning_rates}"
        )

        if val_accuracy > best_accuracy:
            best_accuracy = val_accuracy
            best_state = deepcopy(model.state_dict())
            torch.save(
                {
                    "state_dict": best_state,
                    "labels": labels,
                    "image_size": image_size,
                    "val_accuracy": val_accuracy,
                    "phase": phase_name,
                    "epoch": epoch,
                },
                output,
            )
            print(f"Saved best checkpoint ({best_accuracy:.2%}) to {output}")

        if val_accuracy > phase_best + 0.001:
            phase_best = val_accuracy
            epochs_without_improvement = 0
        else:
            epochs_without_improvement += 1
            if epochs_without_improvement >= patience:
                print(f"Early stopping {phase_name}; best validation accuracy {phase_best:.2%}")
                break

    return best_accuracy, best_state


def main():
    args = parse_args()
    if args.warmup_epochs < 1 or args.finetune_epochs < 1 or args.batch_size < 1:
        raise ValueError("Epoch counts and batch-size must be positive integers.")
    if args.patience < 1:
        raise ValueError("patience must be a positive integer.")

    random.seed(args.seed)
    torch.manual_seed(args.seed)
    train_set, val_set, labels = make_datasets(args.data_dir, args.image_size)
    if args.device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA was requested, but it is not available.")
    device = torch.device(
        "cuda" if args.device == "auto" and torch.cuda.is_available()
        else "cpu" if args.device == "auto"
        else args.device
    )

    train_loader = DataLoader(
        train_set, batch_size=args.batch_size, shuffle=True, num_workers=0,
        pin_memory=device.type == "cuda",
    )
    val_loader = DataLoader(
        val_set, batch_size=args.batch_size, shuffle=False, num_workers=0,
        pin_memory=device.type == "cuda",
    )

    model = mobilenet_v3_large(weights=MobileNet_V3_Large_Weights.IMAGENET1K_V2)
    model.classifier[2].p = 0.5
    model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, len(labels))
    model.to(device)
    args.output.parent.mkdir(parents=True, exist_ok=True)

    class_counts = torch.bincount(torch.tensor(train_set.targets), minlength=len(labels)).float()
    class_weights = (class_counts.sum() / (len(labels) * class_counts)).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights, label_smoothing=0.05)
    best_accuracy = -1.0
    best_state = None

    for parameter in model.features.parameters():
        parameter.requires_grad = False
    for parameter in model.classifier.parameters():
        parameter.requires_grad = True
    warmup_optimizer = AdamW(
        model.classifier.parameters(), lr=args.classifier_learning_rate, weight_decay=args.weight_decay
    )
    print(f"Device: {device}; classes: {labels}; warm-up with frozen backbone")
    best_accuracy, best_state = train_phase(
        model, train_loader, val_loader, criterion, warmup_optimizer, device,
        args.warmup_epochs, args.patience, "warm-up", False, 1e-6,
        args.output, labels, args.image_size, best_accuracy, best_state,
    )

    layer_count = set_trainable_layers(model, args.unfreeze_last_layers)
    if args.backbone_learning_rate <= 0 or args.classifier_learning_rate <= 0:
        raise ValueError("Learning rates must be positive.")
    fine_tune_optimizer = AdamW([
        {
            "params": [p for p in model.features.parameters() if p.requires_grad],
            "lr": args.backbone_learning_rate,
        },
        {"params": model.classifier.parameters(), "lr": args.classifier_learning_rate},
    ], weight_decay=args.weight_decay)
    print(
        f"Fine-tuning last {args.unfreeze_last_layers} of {layer_count} "
        "parameterized backbone layers"
    )
    best_accuracy, best_state = train_phase(
        model, train_loader, val_loader, criterion, fine_tune_optimizer, device,
        args.finetune_epochs, args.patience, "fine-tune", True, 1e-6,
        args.output, labels, args.image_size, best_accuracy, best_state,
    )

    if best_state is not None:
        model.load_state_dict(best_state)
    print(f"Training complete; best validation accuracy: {best_accuracy:.2%}")


if __name__ == "__main__":
    main()