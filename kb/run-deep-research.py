#!/usr/bin/env python3
"""
Automate deep research prompts via Claude Code or GitHub Copilot CLI in YOLO mode.
Reads exact prompts from deep-research-prompt.md, substitutes region/date.

Usage:
  python run-deep-research.py                          # All regions, all categories (claude)
  python run-deep-research.py --region piemonte        # Single region
  python run-deep-research.py --region piemonte --category RESTAURANT  # Single combo
  python run-deep-research.py --model haiku            # Use a specific model
  python run-deep-research.py --dry-run                # Print commands without running

Pick provider:
  python run-deep-research.py --provider claude   ...  # Claude Code CLI (default)
  python run-deep-research.py --provider copilot  ...  # GitHub Copilot CLI
                                                       # requires COPILOT_GITHUB_TOKEN,
                                                       # GH_TOKEN, or GITHUB_TOKEN

Per-comune mode (reads comuni.csv, one call per comune):
  python run-deep-research.py --per-comune --region friuli-venezia-giulia --category RESTAURANT
  python run-deep-research.py --per-comune --region friuli-venezia-giulia --category RESTAURANT --comune "Trieste,Udine"
"""

import csv
import os
import subprocess
import sys
import re
import time
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

# Rate-limit protection
DELAY_BETWEEN_CALLS = 3          # seconds between successful calls
PAUSE_EVERY_N = 15               # pause after every N calls
PAUSE_DURATION = 60              # seconds to pause
CIRCUIT_BREAKER_THRESHOLD = 3    # consecutive failures before long wait
CIRCUIT_BREAKER_WAIT = 120       # seconds to wait when circuit breaks
BACKOFF_INITIAL = 10             # initial backoff on failure (seconds)
BACKOFF_MAX = 120                # max backoff (seconds)

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


def adapt_prompt_per_comune(prompt: str, region_id: str, region_name: str,
                            comune_name: str, province: str, lat: str, lng: str,
                            today: str, save_path: str) -> str:
    """Adapt a region-level prompt to focus on a single comune."""
    adapted = prompt.replace("{REGIONE}", region_name)
    adapted = adapted.replace("{REGION_ID}", region_id)
    adapted = adapted.replace("{DATA_ODIERNA}", today)

    scope = (
        f"IMPORTANTE: Concentra la ricerca ESCLUSIVAMENTE sul comune di {comune_name} "
        f"(provincia di {province}, coordinate: {lat}, {lng}) nella regione {region_name}. "
        f"Non includere altri comuni. Copri solo {comune_name} e le sue frazioni/località. "
        f"Se il comune è piccolo e ha poche voci, descrivi comunque tutto ciò che c'è — "
        f"anche una sola voce va bene. Se non trovi NULLA di rilevante per questa categoria "
        f"in questo comune, scrivi un breve paragrafo che lo spiega.\n\n"
    )
    adapted = scope + adapted

    # Tell Claude NOT to add an h1 title — we'll add that in the merge step.
    # Start directly with h2 for the comune.
    adapted += (
        f"\n\nFORMATTO OUTPUT: NON includere un titolo h1 (#). Inizia direttamente con "
        f"## {comune_name} come intestazione principale, poi usa h3 (###) per ogni voce. "
        f"Scrivi SOLO il contenuto per {comune_name}, senza introduzione generale sulla regione."
        f"\n\nIMPORTANT: Save the complete output as a markdown file at {save_path}. "
        f"Create the directory if it doesn't exist. Write the FULL document to the file — "
        f"do not truncate or summarize."
    )

    return adapted


def merge_comune_files(category_dir: Path, region_name: str, category_id: str, comuni_names: list[str]) -> None:
    """Merge per-comune markdown files into a single knowledge.md."""
    comuni_dir = category_dir / ".comuni"
    if not comuni_dir.exists():
        print(f"  WARN: No .comuni directory found at {comuni_dir}")
        return

    parts: list[str] = []

    # Add a header for the merged document
    category_labels = {
        "RESTAURANT": "Ristoranti", "BAR": "Bar e Caffetterie", "MUSEUM": "Musei",
        "CHURCH": "Chiese e Luoghi di Culto", "LANDMARK": "Monumenti e Attrazioni",
        "PARK": "Parchi e Natura", "NEIGHBORHOOD": "Quartieri e Zone",
        "VENUE": "Locali e Intrattenimento", "ROOFTOP": "Rooftop e Punti Panoramici",
        "EVENT_VENUE": "Sale Eventi e Spazi Culturali", "WINERY": "Cantine e Produttori di Vino",
        "MARKET": "Mercati", "EXPERIENCE_SITE": "Esperienze", "SAGRA": "Sagre e Feste",
        "BEACH": "Spiagge", "AGRITURISMO": "Agriturismi", "FESTIVAL": "Feste e Celebrazioni",
        "DANCE": "Discoteche e Locali da Ballo", "STREET_FOOD": "Street Food", "PUB": "Pub e Birrerie",
    }
    label = category_labels.get(category_id, category_id)
    parts.append(f"# {label} — {region_name}\n\n")
    parts.append(f"Guida completa per comune. Generata il {date.today().strftime('%d/%m/%Y')}.\n")

    merged_count = 0
    for comune_name in comuni_names:
        slug = slugify(comune_name)
        file_path = comuni_dir / f"{slug}.md"
        if file_path.exists() and file_path.stat().st_size > 50:
            content = file_path.read_text(encoding="utf-8").strip()
            parts.append(f"\n---\n\n{content}\n")
            merged_count += 1

    if merged_count == 0:
        print(f"  WARN: No comune files to merge")
        return

    knowledge_path = category_dir / "knowledge.md"
    knowledge_path.write_text("".join(parts), encoding="utf-8")
    print(f"  Merged {merged_count} comuni into {knowledge_path}")


def load_comuni(region_id: str) -> list[dict[str, str]]:
    """Load comuni from kb/{region_id}/comuni.csv."""
    csv_path = KB_DIR / region_id / "comuni.csv"
    if not csv_path.exists():
        print(f"ERROR: Cannot find {csv_path}")
        sys.exit(1)

    comuni: list[dict[str, str]] = []
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None or "name" not in reader.fieldnames or "province" not in reader.fieldnames:
            print(f"ERROR: {csv_path} must have 'name' and 'province' columns.")
            print(f"Found columns: {reader.fieldnames}")
            sys.exit(1)
        for row in reader:
            comuni.append({
                "name": row.get("name", "").strip(),
                "province": row.get("province", "").strip(),
                "latitude": row.get("latitude", "").strip(),
                "longitude": row.get("longitude", "").strip(),
            })

    if not comuni:
        print(f"ERROR: {csv_path} has no data rows.")
        sys.exit(1)

    return comuni


def slugify(name: str) -> str:
    """Convert a comune name to a filesystem-safe slug."""
    slug = name.lower()
    slug = slug.replace("'", "-").replace("'", "-")
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


COPILOT_TOKEN_VARS = ("COPILOT_GITHUB_TOKEN", "GH_TOKEN", "GITHUB_TOKEN")


def build_agent_cmd(provider: str, prompt: str, working_dir: str,
                    model: str | None) -> list[str]:
    """Build the subprocess command for the selected agent CLI."""
    if provider == "claude":
        cmd = ["claude", "-p", prompt, "--dangerously-skip-permissions"]
        if model:
            cmd.extend(["--model", model])
        return cmd

    if provider == "copilot":
        # --allow-all-tools    : skip every per-tool approval prompt
        # --no-ask-user        : never pause to ask the user a question
        # --allow-all-paths    : don't prompt for file-write path approvals
        # --add-dir            : widen the allowed-paths list to the repo root,
        #                        so the agent can write under kb/
        cmd = [
            "copilot",
            "-p", prompt,
            "--allow-all-tools",
            "--no-ask-user",
            "--allow-all-paths",
            "--add-dir", working_dir,
        ]
        if model:
            cmd.extend(["--model", model])
        return cmd

    raise ValueError(f"Unknown provider: {provider}")


def build_agent_env(provider: str) -> dict[str, str]:
    """Build the environment dict for the selected agent CLI."""
    if provider == "claude":
        # Strip ANTHROPIC_API_KEY so claude uses the Max subscription, not API credits
        return {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}
    # copilot: preserve environment (GH_TOKEN / COPILOT_GITHUB_TOKEN / GITHUB_TOKEN
    # are read from here in headless mode)
    return os.environ.copy()


def run_agent(provider: str, prompt: str, working_dir: str,
              dry_run: bool = False, model: str | None = None) -> bool:
    cmd = build_agent_cmd(provider, prompt, working_dir, model)

    if dry_run:
        model_str = f" --model {model}" if model else ""
        flags = " ".join(cmd[3:])  # everything after "<cli> -p <prompt>"
        print(f"  [DRY RUN] Would run: {cmd[0]} -p '<{len(prompt)} chars>' {flags}{model_str}")
        print(f"  First 200 chars: {prompt[:200]}...")
        return True

    env = build_agent_env(provider)

    try:
        result = subprocess.run(
            cmd,
            cwd=working_dir,
            timeout=600,  # 10 min max per prompt
            capture_output=True,
            text=True,
            env=env,
        )
        if result.returncode != 0:
            err_msg = (result.stderr or result.stdout or "").strip()
            print(f"    ERROR (exit {result.returncode}): {err_msg[:500]}")
            return False
        return True
    except subprocess.TimeoutExpired:
        print("    ERROR: Timed out after 10 minutes")
        return False
    except FileNotFoundError:
        cli_name = cmd[0]
        install_hint = {
            "claude": "Is Claude Code installed?",
            "copilot": "Install with: brew install copilot-cli  (or  npm i -g @github/copilot)",
        }.get(provider, "")
        print(f"    ERROR: '{cli_name}' CLI not found. {install_hint}")
        sys.exit(1)


class RateLimiter:
    """Circuit breaker + exponential backoff + periodic pause."""

    def __init__(self) -> None:
        self.consecutive_failures = 0
        self.backoff = BACKOFF_INITIAL
        self.calls_since_pause = 0

    def before_call(self) -> None:
        """Periodic pause every N successful calls."""
        if self.calls_since_pause > 0 and self.calls_since_pause % PAUSE_EVERY_N == 0:
            print(f"    [THROTTLE] Pausing {PAUSE_DURATION}s after {self.calls_since_pause} calls...")
            time.sleep(PAUSE_DURATION)

    def after_success(self) -> None:
        """Reset failure state, apply cooldown delay."""
        self.consecutive_failures = 0
        self.backoff = BACKOFF_INITIAL
        self.calls_since_pause += 1
        time.sleep(DELAY_BETWEEN_CALLS)

    def after_failure(self) -> bool:
        """Apply backoff. Returns True to retry, False to skip and continue."""
        self.consecutive_failures += 1

        if self.consecutive_failures >= CIRCUIT_BREAKER_THRESHOLD:
            print(f"    [CIRCUIT BREAKER] {self.consecutive_failures} consecutive failures. "
                  f"Waiting {CIRCUIT_BREAKER_WAIT}s...")
            time.sleep(CIRCUIT_BREAKER_WAIT)
            self.consecutive_failures = 0
            self.backoff = BACKOFF_INITIAL
            return True  # retry after circuit breaker wait

        print(f"    [BACKOFF] Waiting {self.backoff}s before next call...")
        time.sleep(self.backoff)
        self.backoff = min(self.backoff * 2, BACKOFF_MAX)
        return False  # don't retry, move on


def main():
    parser = argparse.ArgumentParser(description="Run deep research prompts via Claude Code or GitHub Copilot CLI")
    parser.add_argument("--provider", choices=["claude", "copilot"], default="claude",
                        help="Agent CLI to use (default: claude)")
    parser.add_argument("--region", help="Single region ID (e.g. piemonte)")
    parser.add_argument("--category", help="Single category (e.g. RESTAURANT)")
    parser.add_argument("--model",
                        help="Model to use. Claude: haiku/sonnet/opus. "
                             "Copilot: gpt-5.2, claude-sonnet-4.6, claude-haiku-4.5, gpt-5.3-codex, ...")
    parser.add_argument("--per-comune", action="store_true",
                        help="Run one prompt per comune (reads comuni.csv). Requires --region.")
    parser.add_argument("--comune", help="Comma-separated comune names to filter (e.g. 'Trieste,Udine')")
    parser.add_argument("--dry-run", action="store_true", help="Print commands without running")
    parser.add_argument("--refetch", action="store_true",
                        help="Re-fetch even if output already exists (default: skip existing)")
    parser.add_argument("--prompt-file", type=Path, default=PROMPT_FILE,
                        help="Path to deep-research-prompt.md (default: kb/deep-research-prompt.md)")
    args = parser.parse_args()

    if args.per_comune and not args.region:
        print("ERROR: --per-comune requires --region")
        sys.exit(1)

    if args.comune and not args.per_comune:
        print("ERROR: --comune requires --per-comune")
        sys.exit(1)

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
    skip_existing = not args.refetch

    # Validate region exists
    if args.region and args.region not in REGIONS:
        print(f"ERROR: Unknown region '{args.region}'.")
        print(f"Available: {', '.join(REGIONS.keys())}")
        sys.exit(1)

    # Validate category exists
    if args.category and args.category not in prompts:
        print(f"ERROR: Category '{args.category}' not found in prompt file.")
        print(f"Available: {', '.join(prompts.keys())}")
        sys.exit(1)

    regions_to_run = {args.region: REGIONS[args.region]} if args.region else REGIONS
    categories_to_run = [args.category] if args.category else list(prompts.keys())
    model = args.model
    provider = args.provider

    # Copilot headless preflight: one of these env vars must be set
    if provider == "copilot" and not args.dry_run:
        if not any(os.environ.get(v) for v in COPILOT_TOKEN_VARS):
            print(f"ERROR: Copilot requires one of {', '.join(COPILOT_TOKEN_VARS)} "
                  f"to be set in the environment for headless use.")
            sys.exit(1)

    succeeded = 0
    failed = 0
    skipped = 0

    # --- Per-comune mode ---
    if args.per_comune:
        region_id = args.region
        region_name = REGIONS[region_id]
        all_comuni = load_comuni(region_id)
        comuni = all_comuni

        # Filter comuni if --comune provided
        if args.comune:
            filter_names = {n.strip().lower() for n in args.comune.split(",")}
            comuni = [c for c in comuni if c["name"].lower() in filter_names]
            matched_names = {c["name"].lower() for c in comuni}
            unmatched = filter_names - matched_names
            if unmatched:
                print(f"WARN: These comuni were not found in CSV and will be skipped: {', '.join(sorted(unmatched))}")
            if not comuni:
                print(f"ERROR: No matching comuni found for: {args.comune}")
                sys.exit(1)

        total = len(comuni) * len(categories_to_run)

        print(f"Deep Research Runner (per-comune mode)")
        print(f"  Prompt file: {prompt_file}")
        print(f"  Provider: {provider}")
        print(f"  Region: {region_name} ({region_id})")
        print(f"  Comuni: {len(comuni)} | Categories: {len(categories_to_run)} | Total: {total}")
        print(f"  Model: {model or 'default'}")
        print(f"  Date: {today}")
        print(f"  Working dir: {working_dir}")
        print(f"  Skip existing: {skip_existing}")
        print(f"  Output: kb/{region_id}/{{CATEGORY}}/knowledge.md (merged)")
        print()

        # Process each category, iterating over comuni within it
        limiter = RateLimiter()
        for category_id in categories_to_run:
            category_dir = KB_DIR / region_id / category_id
            comuni_dir = category_dir / ".comuni"
            comuni_dir.mkdir(parents=True, exist_ok=True)

            print(f"=== {category_id} ===")

            i = 0
            for comune in comuni:
                i += 1
                comune_slug = slugify(comune["name"])
                out_path = comuni_dir / f"{comune_slug}.md"

                if skip_existing and out_path.exists() and out_path.stat().st_size > 50:
                    print(f"  [{i}/{len(comuni)}] SKIP {comune['name']} (exists)")
                    skipped += 1
                    continue

                print(f"  [{i}/{len(comuni)}] {comune['name']} ({comune['province']})")

                save_path = f"kb/{region_id}/{category_id}/.comuni/{comune_slug}.md"
                prompt = adapt_prompt_per_comune(
                    prompts[category_id], region_id, region_name,
                    comune["name"], comune["province"],
                    comune["latitude"], comune["longitude"],
                    today, save_path,
                )

                limiter.before_call()
                ok = run_agent(provider, prompt, working_dir, dry_run=args.dry_run, model=model)
                if ok:
                    succeeded += 1
                    print(f"    Done")
                    if not args.dry_run:
                        limiter.after_success()
                else:
                    retry = limiter.after_failure() if not args.dry_run else False
                    if retry:
                        print(f"    Retrying {comune['name']}...")
                        ok = run_agent(provider, prompt, working_dir, dry_run=args.dry_run, model=model)
                        if ok:
                            succeeded += 1
                            print(f"    Done (retry)")
                            limiter.after_success()
                        else:
                            failed += 1
                            print(f"    Failed (retry)")
                    else:
                        failed += 1
                        print(f"    Failed")

            # Merge all comune files into knowledge.md
            # Use all_comuni order so the merged file covers the full region,
            # even if we only ran a subset with --comune
            all_names = [c["name"] for c in all_comuni]
            if not args.dry_run:
                print(f"\n  Merging into kb/{region_id}/{category_id}/knowledge.md ...")
                merge_comune_files(category_dir, region_name, category_id, all_names)
            else:
                print(f"\n  [DRY RUN] Would merge .comuni/*.md → knowledge.md")
            print()

    # --- Standard region mode ---
    else:
        total = len(regions_to_run) * len(categories_to_run)

        print(f"Deep Research Runner")
        print(f"  Prompt file: {prompt_file}")
        print(f"  Provider: {provider}")
        print(f"  Categories found: {len(prompts)} ({', '.join(prompts.keys())})")
        print(f"  Regions: {len(regions_to_run)} | Categories: {len(categories_to_run)} | Total: {total}")
        print(f"  Model: {model or 'default'}")
        print(f"  Date: {today}")
        print(f"  Working dir: {working_dir}")
        print(f"  Skip existing: {skip_existing}")
        print()

        limiter = RateLimiter()
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

                limiter.before_call()
                ok = run_agent(provider, prompt, working_dir, dry_run=args.dry_run, model=model)
                if ok:
                    succeeded += 1
                    print(f"  Done")
                    if not args.dry_run:
                        limiter.after_success()
                else:
                    retry = limiter.after_failure() if not args.dry_run else False
                    if retry:
                        print(f"  Retrying {region_name}/{category_id}...")
                        ok = run_agent(provider, prompt, working_dir, dry_run=args.dry_run, model=model)
                        if ok:
                            succeeded += 1
                            print(f"  Done (retry)")
                            limiter.after_success()
                        else:
                            failed += 1
                            print(f"  Failed (retry)")
                    else:
                        failed += 1
                        print(f"  Failed")

    print(f"\n{'=' * 40}")
    print(f"Done: {succeeded} succeeded, {failed} failed, {skipped} skipped")


if __name__ == "__main__":
    main()
