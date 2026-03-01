"""
GARD Rare Disease Scraper - Selenium Edition
Handles JavaScript-rendered pagination correctly.

Requirements:
    pip install selenium pandas requests beautifulsoup4
    brew install --cask chromedriver        # Mac
    # OR: pip install webdriver-manager     (auto-downloads chromedriver)
"""

import time
import re
import os
import pandas as pd
import requests
from bs4 import BeautifulSoup

# ── Try to import Selenium; give clear error if missing ──────────────────────
try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    try:
        from webdriver_manager.chrome import ChromeDriverManager
        USE_WDM = True
    except ImportError:
        USE_WDM = False
except ImportError:
    raise SystemExit(
        "Selenium not installed. Run:\n"
        "  pip install selenium webdriver-manager pandas beautifulsoup4"
    )

BASE_URL    = "https://rarediseases.info.nih.gov"
OUTPUT_FILE = "gard_symptoms_list.csv"
SAVE_EVERY  = 50
TOTAL_PAGES = 614   # ~6,137 diseases total

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
}


# ── Selenium browser (used only for listing pages) ───────────────────────────

def make_driver():
    opts = Options()
    opts.add_argument("--headless")          # run invisibly
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--window-size=1920,1080")
    opts.add_argument(f"user-agent={HEADERS['User-Agent']}")

    if USE_WDM:
        service = Service(ChromeDriverManager().install())
        return webdriver.Chrome(service=service, options=opts)
    else:
        return webdriver.Chrome(options=opts)


def get_disease_links_selenium(driver, page: int):
    """
    Use Selenium to load the page with JS executed, then extract disease links.
    Correct URL: ?category=&page=N&letter=&search=
    """
    url = f"{BASE_URL}/diseases?category=&page={page}&letter=&search="
    driver.get(url)

    # Wait until disease cards appear
    try:
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "a.text-reset"))
        )
    except Exception:
        print(f"    [WARN] Timed out waiting for page {page}")
        return []

    time.sleep(1)  # let Angular finish rendering

    soup = BeautifulSoup(driver.page_source, "html.parser")
    diseases = []
    for a_tag in soup.select('a.text-reset[href^="diseases/"]'):
        h5 = a_tag.find("h5", class_="text-green") or a_tag.find("h5")
        if not h5:
            continue
        name = h5.get_text(strip=True)
        href = a_tag["href"]
        if name and href:
            diseases.append({"name": name, "url": f"{BASE_URL}/{href}"})

    return diseases


# ── requests + BS4 (used for individual disease pages — much faster) ─────────

def get_soup_requests(url: str):
    for attempt in range(3):
        try:
            r = requests.get(url, headers=HEADERS, timeout=20)
            r.raise_for_status()
            return BeautifulSoup(r.text, "html.parser")
        except Exception as e:
            print(f"    [WARN] Attempt {attempt+1}/3 failed: {e}")
            time.sleep(2 ** attempt)
    return None


def get_symptoms(disease_url: str):
    """
    Individual disease pages ARE pre-rendered by Scully, so plain
    requests works fine here — no Selenium needed.
    """
    soup = get_soup_requests(disease_url)
    if not soup:
        return "N/A"

    full_text = soup.get_text(separator="\n")

    symptoms = []
    match = re.search(
        r"Sort by:\s*Medical Term\s*([\s\S]+?)This information comes from",
        full_text
    )
    if match:
        block = match.group(1)
        lines = [l.strip() for l in block.splitlines() if l.strip()]
        seen  = set()
        for line in lines:
            norm = line.lower()
            if norm in seen:
                break   # hit duplicate block, stop
            seen.add(norm)
            if any(skip in norm for skip in [
                "sort by", "filter", "medical term", "frequency",
                "description", "synonym", "open detail", "body system",
                "all systems", "filter and sort", "uncommon", "frequent",
                "always", "never", "occasional", "very frequent",
            ]):
                continue
            if len(line) > 2:
                symptoms.append(line)

    # Fallback
    if not symptoms:
        for heading in soup.find_all(["h2","h3","h4","h5","h6"]):
            if any(kw in heading.get_text(strip=True).lower()
                   for kw in ("symptom", "sign", "clinical feature")):
                sib = heading.find_next_sibling()
                while sib:
                    if getattr(sib, "name", "") in ("h2","h3","h4","h5","h6"):
                        break
                    for li in sib.find_all("li"):
                        t = li.get_text(separator=" ", strip=True)
                        if t and len(t) > 2:
                            symptoms.append(t)
                    sib = sib.find_next_sibling()
                if symptoms:
                    break

    return "; ".join(dict.fromkeys(symptoms)) if symptoms else "No symptoms listed"


# ── Persistence ───────────────────────────────────────────────────────────────

def load_existing():
    if not os.path.exists(OUTPUT_FILE):
        return set(), []
    try:
        df = pd.read_csv(OUTPUT_FILE, encoding="utf-8-sig")
        return set(df["url"].dropna().tolist()), df.to_dict("records")
    except Exception:
        return set(), []


def save(all_data):
    pd.DataFrame(all_data).to_csv(OUTPUT_FILE, index=False, encoding="utf-8-sig")


# ── Main ─────────────────────────────────────────────────────────────────────

def scrape_gard(num_pages=50):
    done_urls, all_data = load_existing()
    if done_urls:
        print(f"Resuming — {len(done_urls)} diseases already scraped.\n")

    print("Starting Chrome (headless)...")
    driver = make_driver()

    scraped = 0
    prev_names = set()   # detect if pagination is stuck

    try:
        for page_num in range(1, num_pages + 1):
            print(f"\n[Page {page_num}/{TOTAL_PAGES}]")
            links = get_disease_links_selenium(driver, page_num)

            if not links:
                print("  No diseases found — stopping.")
                break

            # Detect stuck pagination (same diseases as last page)
            current_names = {d["name"] for d in links}
            if page_num > 1 and current_names == prev_names:
                print("  [ERROR] Same diseases as previous page — pagination stuck. Stopping.")
                break
            prev_names = current_names

            new_links = [d for d in links if d["url"] not in done_urls]
            print(f"  {len(links)} diseases, {len(new_links)} new.")

            for d in new_links:
                print(f"  -> {d['name']}")
                symptoms = get_symptoms(d["url"])
                all_data.append({
                    "disease_name": d["name"],
                    "symptoms":     symptoms,
                    "url":          d["url"],
                })
                done_urls.add(d["url"])
                scraped += 1

                if scraped % SAVE_EVERY == 0:
                    save(all_data)
                    print(f"  [AUTO-SAVE] {len(all_data)} total saved.")

                time.sleep(0.5)   # polite delay between disease pages

            time.sleep(1)   # polite delay between listing pages

    finally:
        driver.quit()
        save(all_data)
        print(f"\n{'='*60}")
        print(f"DONE. {len(all_data)} diseases saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    scrape_gard(num_pages=50)