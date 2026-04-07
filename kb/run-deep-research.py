#!/usr/bin/env python3
"""
Automate deep research prompts via Claude Code CLI in YOLO mode.
Reads exact prompts from deep-research-prompt.md, substitutes region/date.

Usage:
  python run-deep-research.py                          # All regions, all categories
  python run-deep-research.py --region piemonte        # Single region
  python run-deep-research.py --region piemonte --category RESTAURANT  # Single combo
  python run-deep-research.py --dry-run                # Print commands without running
"""

import subprocess
import sys
import re
import argparse
from datetime import date
from pathlib import Path

# Italian month names for date formatting
ITALIAN_MONTHS = [
    "", "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
    "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
]

KB_DIR = Path(__file__).parent
PROMPT_FILE = KB_DIR / "deep-research-prompt.md"

REGIONS = {
    "piemonte": "Piemonte",
    "valle-d-aosta": "Valle d'Aosta",
    "lombardia": "Lombardia",
    "trentino-alto-adige": "Trentino-Alto Adige",
    "veneto": "Veneto",
    "friuli-venezia-giulia": "Friuli Venezia Giulia",
    "liguria": "Liguria",
    "emilia-romagna": "Emilia-Romagna",
    "toscana": "Toscana",
    "umbria": "Umbria",
    "marche": "Marche",
    "lazio": "Lazio",
    "abruzzo": "Abruzzo",
    "molise": "Molise",
    "campania": "Campania",
    "puglia": "Puglia",
    "basilicata": "Basilicata",
    "calabria": "Calabria",
    "sicilia": "Sicilia",
    "sardegna": "Sardegna",
}


def parse_prompts(prompt_file: Path) -> dict[str, str]:
    """Parse deep-research-prompt.md and extract category → prompt text."""
    content = prompt_file.read_text(encoding="utf-8")

    # Match: ## N. CATEGORY — Title\n\n```\n...prompt...\n```
    pattern = re.compile(
        r"^## \d+\.\s+(\w+)\s+—.*?\n\n```\n(.*?)\n```",
        re.MULTILINE | re.DOTALL,
    )

    prompts: dict[str, str] = {}
    for match in pattern.finditer(content):
        category = match.group(1).strip()
        prompt_text = match.group(2).strip()
        prompts[category] = prompt_text

    return prompts


def adapt_prompt(prompt: str, region_id: str, region_name: str, today: str, save_path: str) -> str:
    """Replace {REGIONE}, {REGION_ID}, {DATA_ODIERNA} placeholders and append save instruction."""
    adapted = prompt.replace("{REGIONE}", region_name)
    adapted = adapted.replace("{REGION_ID}", region_id)
    adapted = adapted.replace("{DATA_ODIERNA}", today)

    adapted += f"\n\nIMPORTANT: Save the complete output as a markdown file at {save_path}. Create the directory if it doesn't exist. Write the FULL document to the file — do not truncate or summarize."

    return adapted


def run_claude(prompt: str, working_dir: str, dry_run: bool = False) -> bool:
    cmd = [
        "claude",
        "-p", prompt,
        "--dangerously-skip-permissions",
    ]

    if dry_run:
        print(f"  [DRY RUN] Would run: claude -p '<{len(prompt)} chars>' --dangerously-skip-permissions")
        print(f"  First 200 chars: {prompt[:200]}...")
        return True

    try:
        result = subprocess.run(
            cmd,
            cwd=working_dir,
            timeout=600,  # 10 min max per prompt
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f"  ERROR (exit {result.returncode}): {result.stderr[:500]}")
            return False
        return True
    except subprocess.TimeoutExpired:
        print("  ERROR: Timed out after 10 minutes")
        return False
    except FileNotFoundError:
        print("  ERROR: 'claude' CLI not found. Is Claude Code installed?")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Run deep research prompts via Claude Code")
    parser.add_argument("--region", help="Single region ID (e.g. piemonte)")
    parser.add_argument("--category", help="Single category (e.g. RESTAURANT)")
    parser.add_argument("--dry-run", action="store_true", help="Print commands without running")
    parser.add_argument("--no-skip-existing", action="store_true",
                        help="Re-run even if knowledge.md exists")
    parser.add_argument("--prompt-file", type=Path, default=PROMPT_FILE,
                        help="Path to deep-research-prompt.md (default: kb/deep-research-prompt.md)")
    args = parser.parse_args()

    prompt_file = args.prompt_file
    if not prompt_file.exists():
        print(f"ERROR: Cannot find prompt file: {prompt_file}")
        sys.exit(1)

    prompts = parse_prompts(prompt_file)
    if not prompts:
        print(f"ERROR: No prompts found in {prompt_file}")
        sys.exit(1)

    d = date.today()
    today = f"{d.day} {ITALIAN_MONTHS[d.month]} {d.year}"
    working_dir = str(KB_DIR.parent)  # ITAL-IA root
    skip_existing = not args.no_skip_existing

    regions_to_run = {args.region: REGIONS[args.region]} if args.region else REGIONS
    categories_to_run = [args.category] if args.category else list(prompts.keys())

    # Validate category exists
    if args.category and args.category not in prompts:
        print(f"ERROR: Category '{args.category}' not found in prompt file.")
        print(f"Available: {', '.join(prompts.keys())}")
        sys.exit(1)

    total = len(regions_to_run) * len(categories_to_run)
    succeeded = 0
    failed = 0
    skipped = 0

    print(f"Deep Research Runner")
    print(f"  Prompt file: {prompt_file}")
    print(f"  Categories found: {len(prompts)} ({', '.join(prompts.keys())})")
    print(f"  Regions: {len(regions_to_run)} | Categories: {len(categories_to_run)} | Total: {total}")
    print(f"  Date: {today}")
    print(f"  Working dir: {working_dir}")
    print(f"  Skip existing: {skip_existing}")
    print()

    i = 0
    for region_id, region_name in regions_to_run.items():
        for category_id in categories_to_run:
            i += 1
            out_path = KB_DIR / region_id / category_id / "knowledge.md"

            if skip_existing and out_path.exists() and out_path.stat().st_size > 1000:
                print(f"[{i}/{total}] SKIP {region_id}/{category_id} (knowledge.md exists)")
                skipped += 1
                continue

            print(f"[{i}/{total}] {region_name} / {category_id}")

            save_path = f"kb/{region_id}/{category_id}/knowledge.md"
            prompt = adapt_prompt(prompts[category_id], region_id, region_name, today, save_path)

            ok = run_claude(prompt, working_dir, dry_run=args.dry_run)
            if ok:
                succeeded += 1
                print(f"  Done")
            else:
                failed += 1
                print(f"  Failed")

    print(f"\n{'=' * 40}")
    print(f"Done: {succeeded} succeeded, {failed} failed, {skipped} skipped")


if __name__ == "__main__":
    main()
