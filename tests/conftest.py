import pytest
from playwright.sync_api import sync_playwright

@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)
        yield b
        b.close()

@pytest.fixture
def page(browser):
    page = browser.new_page(viewport={"width": 390, "height": 844})
    page.goto("http://localhost:51267")
    yield page
    page.close()
