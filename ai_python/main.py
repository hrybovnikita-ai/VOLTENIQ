"""Rank Volteniq catalog products for a shopping query received on stdin."""
import json
import re
import sys

from sklearn.feature_extraction.text import TfidfVectorizer


def recommend(message, products):
    from setup_budget import setup_reply
    setup = setup_reply(message, products)
    if setup is not None:
        return setup
    budget = re.search(r"(under|below|up to|at most)\s*\$?\s*([\d,]+(?:\.\d+)?)", message, re.I)
    if budget:
        limit = float(budget[2].replace(",", ""))
        strict = budget[1].lower() in {"under", "below"}
        products = [p for p in products if p["price"] < limit or (not strict and p["price"] == limit)]
        message = message[:budget.start()] + " " + message[budget.end():]
    if not products:
        return "No catalog products match that budget."
    documents = [" ".join([p["name"], p["category"], p["name"], p["description"]]) for p in products]
    model = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
    catalog = model.fit_transform(documents)
    scores = (catalog @ model.transform([message]).T).toarray().ravel()
    ranked = sorted(zip(products, scores), key=lambda pair: (-pair[1], pair[0]["price"]))
    matches = [p for p, score in ranked if score > 0]
    if not matches and budget:
        matches = [p for p, _ in ranked]
    if not matches:
        return None
    return "Catalog matches (demo prices in USD):\n" + "\n".join(
        f"• {p['name']} — ${p['price']:,.2f}" for p in matches[:3]
    )


if __name__ == "__main__":
    payload = json.load(sys.stdin)
    if "product" in payload:
        from product_expert import answer
        result = {"reply": answer(payload["message"], payload["product"])}
    elif "photo" in payload:
        from visual import visual_search
        result = visual_search(payload["photo"], payload["products"])
    else:
        result = {"reply": recommend(payload["message"], payload["products"])}
    print(json.dumps(result))
