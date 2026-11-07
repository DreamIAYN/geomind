import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server

def test_verify_collinear():
    payload = {
        "goal": {"kind": "collinear", "names": ["A", "B", "C"]},
        "points": [
            {"name": "A", "x": 0, "y": 0},
            {"name": "B", "x": 1, "y": 1},
            {"name": "C", "x": 2.5, "y": 2.5},
        ],
        "lines": [], "circles": [],
    }
    r = server.verify_payload(payload)
    assert r["ok"], r
    assert r["residual"] < 1e-20

def test_verify_false():
    payload = {
        "goal": {"kind": "collinear", "names": ["A", "B", "C"]},
        "points": [
            {"name": "A", "x": 0, "y": 0},
            {"name": "B", "x": 1, "y": 1},
            {"name": "C", "x": 2, "y": 2.5},
        ],
    }
    r = server.verify_payload(payload)
    assert not r["ok"]

def test_generate():
    probs = server.generate_problems(20261019)
    assert len(probs) >= 5
    assert any(p["theorem"] == "欧拉线" for p in probs)
    assert any(p["theorem"] == "九点圆" for p in probs)
    assert all(len(p["vertices"]) == 3 for p in probs)

def test_pdf_compile():
    pdf, err = server._compile_proof_pdf("测试", "已知 $ABC$。", "由全等三角形可得 $AB=AC$。", "")
    assert pdf and pdf[:4] == b"%PDF", err
    assert len(pdf) > 2000

def test_ocr_optional():
    import os
    if not (server.OCR_VENDOR.exists() or os.environ.get("RAPIDOCR")):
        return
    import base64
    from pathlib import Path
    img = Path(__file__).resolve().parents[1] / "screenshots" / "problem-example.png"
    if not img.exists():
        return
    data = "data:image/png;base64," + base64.b64encode(img.read_bytes()).decode()
    r = server.ocr_payload({"image": data})
    assert r["ok"], r
    assert "ABC" in r["text"]

if __name__ == "__main__":
    test_verify_collinear(); test_verify_false(); test_generate(); test_pdf_compile(); test_ocr_optional(); print("test_backend.py: OK")
