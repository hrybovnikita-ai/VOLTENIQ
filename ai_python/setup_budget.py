"""Find a complete in-stock setup within a combined price limit."""
import itertools
import re


def setup_reply(message, products):
    roles = {
        "desktop": lambda p: p["category"] in {"Mac Pro", "Mac Studio", "iMac"},
        "laptop": lambda p: p["category"] == "MacBook",
        "keyboard": lambda p: "keyboard" in p["name"].lower() and p["category"] == "Accessories",
        "mouse": lambda p: "mouse" in p["name"].lower(),
        "trackpad": lambda p: "trackpad" in p["name"].lower(),
    }
    words = message.lower()
    requested = [role for role in roles if re.search(r"\b" + role + r"\b", words)]
    if len(requested) < 2 and not re.search(r"\b(setup|bundle)\b", words):
        return None
    if len(requested) < 2:
        requested = list(dict.fromkeys((requested or ["desktop"]) + ["keyboard", "mouse"]))
    amount = re.search(r"(?:\$\s*|under\s+|budget(?: of)?\s+|up to\s+)(\d[\d,]*(?:\.\d+)?)(k\b)?", words)
    if not amount:
        return "What total budget in USD should I use for your " + ", ".join(requested) + "?"
    limit = round(float(amount[1].replace(",", "")) * (1000 if amount[2] else 1) * 100)
    groups = [[p for p in products if p["stock"] > 0 and roles[role](p)] for role in requested]
    if any(not group for group in groups):
        return "A complete setup is unavailable because a requested item is out of stock."
    def total(bundle):
        return sum(round(p["price"] * 100) for p in bundle)
    cheapest = tuple(min(group, key=lambda p: p["price"]) for group in groups)
    ceiling = limit - int(bool(re.search(r"\b(under|below)\b", words)))
    best = max((b for b in itertools.product(*groups) if total(b) <= ceiling), key=total, default=None)
    if best is None:
        return f"The lowest-priced complete in-stock setup costs ${total(cheapest)/100:,.2f}."
    cost = total(best)
    lines = [f"{p['name']} — ${p['price']:,.2f}" for p in best]
    return "\n".join(["In-stock setup (USD, base configurations):", *lines,
                      f"Total: ${cost/100:,.2f} · Remaining: ${(limit-cost)/100:,.2f}"])
