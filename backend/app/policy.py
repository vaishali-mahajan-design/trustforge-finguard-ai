import re
from pathlib import Path
from .models import EvidenceItem, PolicyMatch

POLICY_DIR = Path(__file__).resolve().parent.parent / "data" / "policies"

def _terms(evidence: list[EvidenceItem]) -> set[str]:
    words: set[str] = set()
    for item in evidence:
        words.update(re.findall(r"[a-zA-Z]{4,}", f"{item.category} {item.statement}".lower()))
    return words

def retrieve_policies(evidence: list[EvidenceItem], top_k: int = 3) -> list[PolicyMatch]:
    """Deterministic keyword retriever for synthetic demo policies, not vector RAG."""
    query_terms = _terms(evidence)
    scored: list[tuple[int, PolicyMatch]] = []
    for path in POLICY_DIR.glob("*.md"):
        text = path.read_text(encoding="utf-8")
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        title = lines[0].lstrip("# ") if lines else path.stem
        body = " ".join(lines[1:])
        body_terms = set(re.findall(r"[a-zA-Z]{4,}", body.lower()))
        matched = sorted(query_terms & body_terms)
        score = len(matched)
        if score:
            scored.append((score, PolicyMatch(policy_id=path.stem.upper(), title=title, excerpt=body[:420], matched_terms=matched[:12])))
    scored.sort(key=lambda x: (-x[0], x[1].policy_id))
    return [item for _, item in scored[:top_k]]
