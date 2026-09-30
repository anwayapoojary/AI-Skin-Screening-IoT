#!/usr/bin/env python
"""Train the skin-lesion screening classifier (transfer learning, PyTorch).

Produces a checkpoint that ai/real_model.RealScreeningModel loads directly.
Screening only — not a diagnostic device. See docs/ml_training.md.

Typical use (HAM10000):

    python scripts/train_skin_model.py \
        --images-dir data/ham10000/images \
        --metadata-csv data/ham10000/HAM10000_metadata.csv \
        --image-col image_id --label-col dx --image-ext .jpg \
        --arch efficientnet_b0 --epochs 15 --batch-size 32 \
        --out ai/weights/skin_model.pt

Or with an ImageFolder layout (one subdirectory per class):

    python scripts/train_skin_model.py --image-folder data/skin_split/train \
        --val-folder data/skin_split/val --out ai/weights/skin_model.pt

The checkpoint stores: state_dict, arch, class_names, suspicious_labels,
model_version, input_size, and validation metrics.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train skin-lesion screening model")
    # Data — either CSV mode or ImageFolder mode.
    p.add_argument("--images-dir", help="Flat directory of images (CSV mode)")
    p.add_argument("--metadata-csv", help="CSV with image + label columns (CSV mode)")
    p.add_argument("--image-col", default="image_id")
    p.add_argument("--label-col", default="dx")
    p.add_argument("--image-ext", default=".jpg", help="Extension appended to image ids if missing")
    p.add_argument("--image-folder", help="ImageFolder train dir (subdir per class)")
    p.add_argument("--val-folder", help="ImageFolder val dir (subdir per class)")

    p.add_argument("--arch", default="efficientnet_b0",
                   choices=["efficientnet_b0", "efficientnet_b3", "mobilenet_v3_large", "resnet50"])
    p.add_argument("--input-size", type=int, default=224)
    p.add_argument("--epochs", type=int, default=15)
    p.add_argument("--batch-size", type=int, default=32)
    p.add_argument("--lr", type=float, default=3e-4)
    p.add_argument("--weight-decay", type=float, default=1e-4)
    p.add_argument("--val-split", type=float, default=0.15, help="Used in CSV mode")
    p.add_argument("--num-workers", type=int, default=2)
    p.add_argument("--freeze-backbone-epochs", type=int, default=2,
                   help="Train only the head for the first N epochs")
    p.add_argument("--suspicious-labels", default="mel,bcc,akiec",
                   help="Comma-separated labels treated as refer/suspicious")
    p.add_argument("--model-version", default="derm-real-1.0.0")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--out", default="ai/weights/skin_model.pt")
    return p.parse_args()


def build_backbone(arch: str, num_classes: int, pretrained: bool = True):
    import torch.nn as nn
    import torchvision.models as tvm

    if arch == "efficientnet_b0":
        m = tvm.efficientnet_b0(weights=tvm.EfficientNet_B0_Weights.DEFAULT if pretrained else None)
        m.classifier[1] = nn.Linear(m.classifier[1].in_features, num_classes)
    elif arch == "efficientnet_b3":
        m = tvm.efficientnet_b3(weights=tvm.EfficientNet_B3_Weights.DEFAULT if pretrained else None)
        m.classifier[1] = nn.Linear(m.classifier[1].in_features, num_classes)
    elif arch == "mobilenet_v3_large":
        m = tvm.mobilenet_v3_large(weights=tvm.MobileNet_V3_Large_Weights.DEFAULT if pretrained else None)
        m.classifier[3] = nn.Linear(m.classifier[3].in_features, num_classes)
    elif arch == "resnet50":
        m = tvm.resnet50(weights=tvm.ResNet50_Weights.DEFAULT if pretrained else None)
        m.fc = nn.Linear(m.fc.in_features, num_classes)
    else:
        raise ValueError(arch)
    return m


def set_backbone_requires_grad(model, arch: str, requires_grad: bool) -> None:
    """Freeze/unfreeze feature extractor, keep the classifier head trainable."""
    for p in model.parameters():
        p.requires_grad = requires_grad
    if arch.startswith("efficientnet"):
        for p in model.classifier.parameters():
            p.requires_grad = True
    elif arch.startswith("mobilenet"):
        for p in model.classifier.parameters():
            p.requires_grad = True
    elif arch == "resnet50":
        for p in model.fc.parameters():
            p.requires_grad = True


class CsvImageDataset:
    """Lazily-decoded dataset from a flat image dir + label CSV."""

    def __init__(self, rows, images_dir, image_ext, class_to_idx, transform):
        self.rows = rows
        self.images_dir = Path(images_dir)
        self.image_ext = image_ext
        self.class_to_idx = class_to_idx
        self.transform = transform

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        from PIL import Image

        name, label = self.rows[i]
        path = self.images_dir / name
        if not path.suffix:
            path = path.with_suffix(self.image_ext)
        img = Image.open(path).convert("RGB")
        return self.transform(img), self.class_to_idx[label]


def build_transforms(input_size: int):
    import torchvision.transforms as T

    mean = (0.485, 0.456, 0.406)
    std = (0.229, 0.224, 0.225)
    train_tf = T.Compose([
        T.Resize((input_size, input_size)),
        T.RandomHorizontalFlip(),
        T.RandomVerticalFlip(),
        T.RandomRotation(20),
        T.ColorJitter(0.1, 0.1, 0.1),
        T.ToTensor(),
        T.Normalize(mean, std),
    ])
    val_tf = T.Compose([
        T.Resize((input_size, input_size)),
        T.ToTensor(),
        T.Normalize(mean, std),
    ])
    return train_tf, val_tf


def load_csv_data(args, train_tf, val_tf):
    import pandas as pd
    from sklearn.model_selection import train_test_split

    df = pd.read_csv(args.metadata_csv)
    df = df[[args.image_col, args.label_col]].dropna()
    classes = sorted(df[args.label_col].unique().tolist())
    class_to_idx = {c: i for i, c in enumerate(classes)}

    rows = list(zip(df[args.image_col].astype(str), df[args.label_col].astype(str)))
    labels = [r[1] for r in rows]
    train_rows, val_rows = train_test_split(
        rows, test_size=args.val_split, random_state=args.seed, stratify=labels
    )
    train_ds = CsvImageDataset(train_rows, args.images_dir, args.image_ext, class_to_idx, train_tf)
    val_ds = CsvImageDataset(val_rows, args.images_dir, args.image_ext, class_to_idx, val_tf)
    return train_ds, val_ds, classes


def load_folder_data(args, train_tf, val_tf):
    from torchvision.datasets import ImageFolder

    train_ds = ImageFolder(args.image_folder, transform=train_tf)
    classes = train_ds.classes
    if args.val_folder:
        val_ds = ImageFolder(args.val_folder, transform=val_tf)
    else:
        import torch
        n_val = int(len(train_ds) * args.val_split)
        n_train = len(train_ds) - n_val
        train_ds, val_ds = torch.utils.data.random_split(
            train_ds, [n_train, n_val], generator=torch.Generator().manual_seed(args.seed)
        )
    return train_ds, val_ds, classes


def compute_class_weights(train_ds, num_classes):
    import torch

    counts = torch.zeros(num_classes)
    # Iterate labels cheaply where possible.
    if hasattr(train_ds, "rows"):
        for _, label in train_ds.rows:
            counts[train_ds.class_to_idx[label]] += 1
    else:
        for _, y in train_ds:
            counts[int(y)] += 1
    counts = torch.clamp(counts, min=1.0)
    weights = counts.sum() / (num_classes * counts)
    return weights


def main() -> None:
    args = parse_args()
    import numpy as np
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader
    from tqdm import tqdm

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)

    train_tf, val_tf = build_transforms(args.input_size)
    if args.image_folder:
        train_ds, val_ds, classes = load_folder_data(args, train_tf, val_tf)
    elif args.images_dir and args.metadata_csv:
        train_ds, val_ds, classes = load_csv_data(args, train_tf, val_tf)
    else:
        raise SystemExit("Provide --image-folder OR (--images-dir and --metadata-csv)")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device} | classes ({len(classes)}): {classes}")

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True,
                              num_workers=args.num_workers, pin_memory=(device.type == "cuda"))
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False,
                            num_workers=args.num_workers, pin_memory=(device.type == "cuda"))

    model = build_backbone(args.arch, len(classes), pretrained=True).to(device)

    class_weights = compute_class_weights(train_ds, len(classes)).to(device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    best_state = None
    best_score = -1.0
    susp = [s.strip() for s in args.suspicious_labels.split(",") if s.strip()]
    susp_idx = [i for i, c in enumerate(classes) if c in susp]

    for epoch in range(args.epochs):
        frozen = epoch < args.freeze_backbone_epochs
        set_backbone_requires_grad(model, args.arch, requires_grad=not frozen)

        model.train()
        running = 0.0
        for x, y in tqdm(train_loader, desc=f"epoch {epoch+1}/{args.epochs} {'(head)' if frozen else ''}"):
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            out = model(x)
            loss = criterion(out, y)
            loss.backward()
            optimizer.step()
            running += loss.item() * x.size(0)
        scheduler.step()
        train_loss = running / len(train_loader.dataset)

        # ---- validation ----
        model.eval()
        all_y, all_p, all_susp = [], [], []
        with torch.no_grad():
            for x, y in val_loader:
                x = x.to(device)
                probs = torch.softmax(model(x), dim=1).cpu()
                preds = probs.argmax(dim=1)
                all_y.extend(y.tolist())
                all_p.extend(preds.tolist())
                if susp_idx:
                    all_susp.extend(probs[:, susp_idx].sum(dim=1).tolist())

        import numpy as np
        y_true = np.array(all_y)
        y_pred = np.array(all_p)
        acc = float((y_true == y_pred).mean())

        # Screening sensitivity: of truly-suspicious lesions, how many the
        # binary (suspicious-prob >= 0.5) rule flags. This is the metric that
        # matters most for a screening tool.
        sens = None
        if susp_idx:
            true_susp = np.isin(y_true, susp_idx)
            flagged = np.array(all_susp) >= 0.5
            if true_susp.sum() > 0:
                sens = float((flagged & true_susp).sum() / true_susp.sum())

        score = sens if sens is not None else acc
        print(f"  train_loss={train_loss:.4f} val_acc={acc:.4f} "
              f"screening_sensitivity={sens if sens is None else round(sens,4)}")

        if score > best_score:
            best_score = score
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

    # ---- final report ----
    from sklearn.metrics import classification_report
    print("\nBest validation classification report (last-epoch preds):")
    try:
        print(classification_report(y_true, y_pred, target_names=classes, zero_division=0))
    except Exception as exc:  # pragma: no cover
        print(f"(report unavailable: {exc})")

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    checkpoint = {
        "state_dict": best_state if best_state is not None else model.state_dict(),
        "arch": args.arch,
        "class_names": classes,
        "suspicious_labels": susp,
        "input_size": args.input_size,
        "model_version": args.model_version,
        "metrics": {"best_score": best_score},
    }
    torch.save(checkpoint, out_path)
    print(f"\nSaved checkpoint -> {out_path}")
    print("Set AI_MODE=real and SCREENING_MODEL_PATH to this file to serve it.")
    print(json.dumps({"classes": classes, "suspicious": susp, "best_score": round(best_score, 4)}, indent=2))


if __name__ == "__main__":
    main()
