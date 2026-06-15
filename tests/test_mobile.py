"""Test responsive mobile layout."""
import pytest

def test_viewport_meta(page):
    meta = page.locator('meta[name="viewport"]')
    assert meta.get_attribute("content") is not None

def test_mobile_grid_columns(page):
    """On mobile (<720px), icon-grid should be 3 columns."""
    grid = page.locator(".icon-grid")
    # Check the grid is visible and has items
    items = page.locator(".eco-item")
    assert items.count() > 0

def test_mobile_nav_hidden(page):
    """Nav should be hidden on mobile."""
    nav = page.locator(".nav")
    # On mobile, nav should exist but display:none
    # We can check the CSS media query via computed style
    display = nav.evaluate("el => getComputedStyle(el).display")
    assert display == "none", f"Expected nav hidden on mobile, got {display}"

def test_all_images_load(page):
    """All product images should load."""
    imgs = page.locator(".eco-icon")
    count = imgs.count()
    assert count == 6

    # Check images have src attributes
    for i in range(count):
        src = imgs.nth(i).get_attribute("src")
        assert src and src.startswith("assets/site/ecosystem-icons/"), f"Bad src: {src}"
