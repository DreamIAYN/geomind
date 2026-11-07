#!/usr/bin/env python3
"""Run the live GeoMind vision endpoint over the 100-problem corpus.

Usage:
    python3 scripts/league100_vision.py --start 1 --end 20 --jobs 4
    python3 scripts/league100_vision.py --all

Results are written to data/league100/vision/<NNN>.json.  Existing files are
kept unless --force is given, so a benchmark run can be resumed.
"""
from __future__ import annotations

import argparse
import base64
import concurrent.futures as cf
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "league100"
OUT = DATA / "vision_v3"
ENDPOINT = "http://127.0.0.1:4174/api/vision"


def one(n: int, model: str | None, force: bool) -> dict:
    dst = OUT / f"{n:03d}.json"
    if dst.exists() and not force:
        try:
            return {"n": n, "skipped": True, "ok": json.loads(dst.read_text()).get("ok")}
        except Exception:
            pass
    img_path = DATA / f"p{n:03d}.png"
    index = json.loads((DATA / "index.json").read_text())
    text = next((x["text"] for x in index if x.get("n") == n), "")
    payload = {
        "image": "data:image/png;base64," + base64.b64encode(img_path.read_bytes()).decode(),
        "text": text,
    }
    if model:
        payload["config"] = {"model": model}
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            result = json.loads(resp.read().decode())
    except Exception as e:  # noqa: BLE001
        result = {"ok": False, "error": f"{type(e).__name__}: {e}"}
    result["_bench"] = {"n": n, "seconds": round(time.time() - t0, 2), "model": model}
    dst.write_text(json.dumps(result, ensure_ascii=False, indent=1))
    return result


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=int, default=1)
    ap.add_argument("--end", type=int, default=100)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--jobs", type=int, default=4)
    ap.add_argument("--model", default=None)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    nums = list(range(1, 101)) if args.all else list(range(args.start, args.end + 1))
    ok = bad = skipped = 0
    t0 = time.time()
    with cf.ThreadPoolExecutor(max_workers=max(1, args.jobs)) as ex:
        futs = {ex.submit(one, n, args.model, args.force): n for n in nums}
        for fut in cf.as_completed(futs):
            n = futs[fut]
            try:
                r = fut.result()
            except Exception as e:  # noqa: BLE001
                print(f"[{n:03d}] EXC {e}", flush=True)
                bad += 1
                continue
            if r.get("skipped"):
                skipped += 1
                print(f"[{n:03d}] skip", flush=True)
            elif r.get("ok"):
                ok += 1
                d = r.get("data") or {}
                print(
                    f"[{n:03d}] ok {r['_bench']['seconds']}s "
                    f"pts={len(d.get('points') or [])} cons={len(d.get('constraints') or [])}",
                    flush=True,
                )
            else:
                bad += 1
                print(f"[{n:03d}] FAIL {str(r.get('error'))[:180]}", flush=True)
    print(f"done ok={ok} bad={bad} skipped={skipped} in {time.time()-t0:.1f}s")
    return 0 if bad == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
