"""Product-specific shopping advice based on the active catalog configuration."""
import re


def answer(question, product):
    q = question.lower()
    category = product["category"]
    selection = product["selections"]
    specs = product.get("specs") or {}
    config = ", ".join(str(v) for v in selection.values() if v)
    intro = f"{product['name']} ({config})" if config else product["name"]
    price = f"${product['unitPrice']:,.2f}"
    def spec(pattern):
        return "; ".join(f"{k}: {v}" for k, v in specs.items() if re.search(pattern, k, re.I))
    computer = category in {"MacBook", "Mac Studio", "Mac Pro", "iMac"}
    audio = category in {"AirPods", "Headphones"}
    options = product.get("options") or []
    storage = next((o["values"] for o in options if o["key"] == "storage"), product.get("storage") or [])
    if "battery" in q or "camera" in q:
        topic = "battery" if "battery" in q else "camera"
        detail = spec("battery|runtime" if topic == "battery" else "camera|lens")
        advice = detail or f"The catalog does not list {topic} specifications for this model."
    elif "storage" in q:
        advice = ("Available storage: " + ", ".join(storage) + ". Choose a smaller capacity for streamed media and cloud files, or a larger one for offline projects and video.") if storage else "This listing has no selectable storage."
    elif "compare" in q:
        advice = " • ".join(o["label"] + ": " + ", ".join(o["values"]) for o in options if len(o["values"]) > 1) or "This model has one listed configuration."
    elif re.search("worth|price|value", q):
        advice = f"The selected configuration costs {price} in the demo store. Compare the capacity and features you will use against a lower-priced configuration."
    elif re.search("program|coding|develop", q):
        advice = "A Mac can run desktop development tools. Consider memory for containers and storage for local builds." if computer else "For a desktop coding workflow, consider a Mac. This product can complement that setup."
    elif re.search("gam|performance|editing|creation", q):
        advice = ("Check the software or game requirements against the configured processor and memory. " if computer else "For this use, check app and device compatibility. ") + (spec("chip|processor|memory|display") or "The catalog supplies no measured benchmarks for this configuration.")
    elif "school" in q:
        advice = "For school, check required apps, portability, and whether you need offline storage." if not audio else "Useful for listening to lectures and calls; check the fit and microphone features for your classes."
    else:
        advice = product["description"] + (" Consider a portable model if you need to work away from a desk." if computer and category != "MacBook" else "")
    return f"{intro} · {price} demo USD\n{advice}"
